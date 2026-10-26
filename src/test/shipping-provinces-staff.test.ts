// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { notificationTarget } from "@/lib/notificationRoutes";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db: PGlite;
describe("shipping provinces and trusted staff alerts", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE profiles(id uuid PRIMARY KEY,role text,account_status text DEFAULT 'active');
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
      CREATE TABLE seller_applications(id uuid PRIMARY KEY,user_id uuid,status text,store_name text,created_at timestamptz DEFAULT now());
      CREATE TABLE products(id uuid PRIMARY KEY,vendor_id uuid,product_type text,name text);
      CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,title text,message text,type text,related_id uuid);
      CREATE TABLE pickup_centers(id uuid,governorate text,is_active boolean);
      CREATE TABLE auth.users(id uuid,email_confirmed_at timestamptz);
      CREATE TABLE orders(id uuid DEFAULT gen_random_uuid());
      CREATE FUNCTION create_order(_items jsonb,_phone text,_shipping_address text,_notes text DEFAULT NULL,_coupon_code text DEFAULT NULL,_payment_method text DEFAULT NULL,_pickup_center_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
      DECLARE _uid uuid:=auth.uid(); result uuid; BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('create_order:' || _uid::text));
      INSERT INTO orders DEFAULT VALUES RETURNING id INTO result; RETURN result; END $$;
      CREATE FUNCTION seller_update_store_profile(text,text,text,text,text,text,text,text,text,text,text,text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF $1='invalid' THEN RAISE EXCEPTION 'invalid profile'; END IF; END $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated;`);
    await db.exec(readFileSync("drizzle/migrations/0042_seller_shipping_provinces_staff_alerts.sql","utf8"));
    await db.exec(readFileSync("drizzle/migrations/0043_atomic_store_shipping_settings.sql","utf8"));
    await db.exec(`INSERT INTO profiles(id,role) VALUES('${id(1)}','vendor'),('${id(2)}','vendor'),('${id(3)}','customer'),('${id(4)}','customer'),('${id(5)}','customer'),('${id(6)}','customer'),('${id(7)}','customer');
      INSERT INTO user_roles VALUES('${id(1)}','vendor'),('${id(2)}','vendor'),('${id(4)}','super_admin'),('${id(4)}','moderator'),('${id(5)}','moderator'),('${id(6)}','admin');
      UPDATE profiles SET account_status='suspended' WHERE id='${id(7)}'; INSERT INTO user_roles VALUES('${id(7)}','moderator');
      INSERT INTO seller_applications(id,user_id,status,store_name) VALUES('${id(11)}','${id(1)}','approved','أ'),('${id(12)}','${id(2)}','approved','ب');
      INSERT INTO products VALUES('${id(21)}','${id(1)}','vendor','أ'),('${id(22)}','${id(2)}','vendor','ب');`);
  },30000);
  afterAll(async () => { await db?.close(); });
  const asSeller = async (n: number) => db.exec(`SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated;`);
  const order = async (province: string, products=[21]) => db.query(`SELECT create_order($1::jsonb,'0912345678',$2)`,[JSON.stringify(products.map((n) => ({product_id:id(n),quantity:1}))),`مشتري، عنوان التوصيل، ${province}`]);
  it("all provinces accepts every one of the 14 Syrian provinces", async () => {
    for (const p of ['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','درعا','السويداء','القنيطرة','الرقة','دير الزور','الحسكة']) await expect(order(p)).resolves.toBeDefined();
  });
  it("seller saves only own coverage and specific provinces reject all unserved orders before writes", async () => {
    await asSeller(1); await db.query(`SELECT seller_update_shipping_regions(false,ARRAY['دمشق','حلب'])`); await db.exec('RESET ROLE');
    expect((await db.query<{shipping_all_provinces:boolean}>(`SELECT shipping_all_provinces FROM seller_applications WHERE user_id='${id(2)}'`)).rows[0]?.shipping_all_provinces).toBe(true);
    await expect(order('دمشق')).resolves.toBeDefined();
    const before=(await db.query('SELECT * FROM orders')).rows.length;
    await expect(order('حمص')).rejects.toThrow('البائع لا يشحن');
    expect((await db.query('SELECT * FROM orders')).rows.length).toBe(before);
  });
  it("multi-seller orders must satisfy every seller and invalid provinces cannot bypass the guard", async () => {
    await expect(order('حمص',[21,22])).rejects.toThrow('البائع لا يشحن');
    await expect(order('بيروت',[22])).rejects.toThrow('محافظة سورية');
  });
  it("empty specific lists and customers cannot change seller coverage", async () => {
    await asSeller(1); await expect(db.query(`SELECT seller_update_shipping_regions(false,'{}')`)).rejects.toThrow('محافظة'); await db.exec('RESET ROLE');
    await asSeller(3); await expect(db.query(`SELECT seller_update_shipping_regions(true,'{}')`)).rejects.toThrow('للبائع'); await db.exec('RESET ROLE');
  });
  it("profile failure rolls back coverage in the atomic save", async () => {
    await asSeller(1); await expect(db.query(`SELECT seller_update_store_settings('{"_store_name":"invalid"}',true,'{}')`)).rejects.toThrow('invalid profile'); await db.exec('RESET ROLE');
    expect((await db.query<{shipping_all_provinces:boolean}>(`SELECT shipping_all_provinces FROM seller_applications WHERE user_id='${id(1)}'`)).rows[0]?.shipping_all_provinces).toBe(false);
  });
  it("store requests and products notify owner and active moderators once, never unrelated or suspended accounts", async () => {
    await db.exec(`INSERT INTO seller_applications(id,user_id,status,store_name) VALUES('${id(13)}','${id(3)}','pending','ج'); INSERT INTO products VALUES('${id(23)}','${id(1)}','vendor','ج'); UPDATE products SET name='محدث' WHERE id='${id(23)}'; UPDATE seller_applications SET status='pending' WHERE id='${id(13)}';`);
    for (const event of ['staff_store_request','staff_product_added']) {
      const result=await db.query<{user_id:string}>(`SELECT user_id FROM notifications WHERE type=$1 AND related_id=$2 ORDER BY user_id`,[event,event==='staff_store_request'?id(13):id(23)]);
      expect(result.rows.map((r)=>r.user_id)).toEqual([id(4),id(5)]);
    }
  });
  it("verified customer registration triggers one alert per recipient and repeats do not duplicate", async () => {
    await db.exec(`INSERT INTO auth.users VALUES('${id(3)}',NULL); UPDATE auth.users SET email_confirmed_at=now() WHERE id='${id(3)}'; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${id(3)}';`);
    expect((await db.query(`SELECT * FROM notifications WHERE type='staff_customer_registered' AND related_id='${id(3)}'`)).rows).toHaveLength(2);
  });
  it("moderator customer alerts do not link to forbidden user management", () => {
    expect(notificationTarget('staff_customer_registered',id(3))).toBe('/notifications');
    expect(notificationTarget('staff_store_request',id(13))).toBe('/admin/seller-applications');
    expect(notificationTarget('staff_product_added',id(23))).toBe('/admin/products');
  });
});