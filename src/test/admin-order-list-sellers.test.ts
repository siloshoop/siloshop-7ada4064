// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, MODERATOR = 3, BUYER = 4, SELLER = 5, SELLER2 = 6, ORDER = 10;
let db: PGlite;
const as = async (n: number) => db.exec(`RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const list = async (search: string | null = null) =>
  (await db.query<any>(`SELECT * FROM admin_list_orders($1)`, [search])).rows;

describe("Owner order list shows each order's seller name and email", () => {
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
      CREATE FUNCTION public.normalize_order_status(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$;
      CREATE TABLE public.profiles(id uuid primary key, full_name text);
      CREATE TABLE public.seller_applications(user_id uuid, store_name text, status text, updated_at timestamptz default now());
      CREATE TABLE public.orders(id uuid primary key, customer_id uuid, parent_order_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
        status text default 'pending', payment_status text default 'pending', total_amount numeric default 0, discount_amount numeric default 0,
        coupon_code text, phone text, shipping_address text, tracking_number text, courier_name text, delivered_at timestamptz, cancelled_at timestamptz,
        cancellation_reason text, order_number text, invoice_number text, payment_method text, estimated_delivery timestamptz, is_frozen boolean);
      CREATE TABLE public.order_items(id uuid primary key, order_id uuid, product_name text, vendor_id uuid, created_at timestamptz default now());
      INSERT INTO auth.users VALUES('${id(SELLER)}','seller@example.com'),('${id(SELLER2)}','second@example.com'),('${id(BUYER)}','buyer@example.com');
      INSERT INTO public.user_roles VALUES('${id(OWNER)}','super_admin'),('${id(MODERATOR)}','moderator');
      INSERT INTO public.profiles VALUES('${id(SELLER)}','Siloshop'),('${id(SELLER2)}','Rasheed'),('${id(BUYER)}','Mohamad');
      INSERT INTO public.seller_applications VALUES('${id(SELLER)}','Silo','approved',now());
      INSERT INTO public.orders(id, customer_id, order_number) VALUES('${id(ORDER)}','${id(BUYER)}','SO-1');
      INSERT INTO public.order_items VALUES('${id(30)}','${id(ORDER)}','ساعة','${id(SELLER)}', now() - interval '1 minute'),
        ('${id(31)}','${id(ORDER)}','حقيبة','${id(SELLER)}', now()),('${id(32)}','${id(ORDER)}','قميص','${id(SELLER2)}', now());`);
    await db.exec(readFileSync("drizzle/migrations/0060_admin_order_list_sellers.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it("the owner sees every seller once, with name, approved store and email", async () => {
    await as(OWNER);
    const [row] = await list();
    expect(row.customer_email).toBe("buyer@example.com");
    expect(row.sellers).toEqual([
      { id: id(SELLER), name: "Siloshop", store_name: "Silo", email: "seller@example.com" },
      { id: id(SELLER2), name: "Rasheed", store_name: null, email: "second@example.com" },
    ]);
  });

  it("the owner can find an order by the seller's email or store name", async () => {
    await as(OWNER);
    expect((await list("second@example")).length).toBe(1);
    expect((await list("Silo")).length).toBe(1);
    expect((await list("nobody@example")).length).toBe(0);
  });

  it("supervisors get no orders from this list", async () => {
    await as(MODERATOR);
    expect(await list()).toEqual([]);
  });
});
