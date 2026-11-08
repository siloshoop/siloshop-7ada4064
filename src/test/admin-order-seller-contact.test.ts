// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, ADMIN = 2, MODERATOR = 3, BUYER = 4, SELLER = 5, ORDER = 10;
let db: PGlite;
const as = async (n: number | null) => db.exec(n === null
  ? `RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE anon`
  : `RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const detail = async () =>
  (await db.query<{ d: any }>(`SELECT admin_get_order_detail($1) d`, [id(ORDER)])).rows[0].d;

describe("Owner order details show who sold and who bought", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public TO anon,authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TYPE public.app_role AS ENUM ('customer','vendor','admin','super_admin','moderator');
      CREATE TABLE auth.users(id uuid primary key, email text);
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2) $$;
      CREATE TABLE public.profiles(id uuid primary key, full_name text, account_status text);
      CREATE TABLE public.seller_applications(user_id uuid, store_name text, status text, updated_at timestamptz default now());
      CREATE TABLE public.products(id uuid primary key, name text, image_url text, images text[]);
      CREATE TABLE public.orders(id uuid primary key, customer_id uuid);
      CREATE TABLE public.order_items(id uuid primary key, order_id uuid, product_id uuid, product_name text, quantity int, price numeric, vendor_id uuid, created_at timestamptz default now());
      CREATE TABLE public.order_status_history(order_id uuid, created_at timestamptz default now());
      CREATE TABLE public.payments(order_id uuid, created_at timestamptz default now());
      CREATE TABLE public.order_notes(order_id uuid, created_at timestamptz default now());
      INSERT INTO auth.users VALUES('${id(SELLER)}','seller@example.com'),('${id(BUYER)}','buyer@example.com');
      INSERT INTO public.user_roles VALUES('${id(OWNER)}','super_admin'),('${id(ADMIN)}','admin'),('${id(MODERATOR)}','moderator'),('${id(BUYER)}','customer');
      INSERT INTO public.profiles VALUES('${id(SELLER)}','Siloshop','active'),('${id(BUYER)}','Mohamad','active');
      INSERT INTO public.seller_applications VALUES('${id(SELLER)}','Silo','approved',now()),('${id(SELLER)}','Old name','rejected',now());
      INSERT INTO public.products VALUES('${id(20)}','ساعة رجالية',null,null);
      INSERT INTO public.orders VALUES('${id(ORDER)}','${id(BUYER)}');
      INSERT INTO public.order_items VALUES('${id(30)}','${id(ORDER)}','${id(20)}','ساعة رجالية',1,63.25,'${id(SELLER)}');`);
    await db.exec(readFileSync("drizzle/migrations/0057_admin_order_detail_people.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it("the owner sees the seller's name, approved store name and email on each product", async () => {
    await as(OWNER);
    const item = (await detail()).items[0];
    expect(item.vendor_name).toBe("Siloshop");
    expect(item.vendor_store_name).toBe("Silo");
    expect(item.vendor_email).toBe("seller@example.com");
  });

  it("the owner sees the shopper's name and email", async () => {
    await as(OWNER);
    const d = await detail();
    expect(d.customer.full_name).toBe("Mohamad");
    expect(d.customer.email).toBe("buyer@example.com");
  });

  it("admins, supervisors, buyers and signed-out visitors are refused", async () => {
    for (const actor of [ADMIN, MODERATOR, BUYER]) {
      await as(actor);
      await expect(detail()).rejects.toThrow("not_authorized");
    }
    await as(null);
    await expect(detail()).rejects.toThrow("not_authorized");
  });
});
