// @vitest-environment node
/// <reference types="node" />
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";

// Rule: only the platform owner (super_admin) may read platform-wide finance data
// (coupon usage, other sellers' performance, payouts, payments). Supervisors
// (moderator) are refused; sellers and buyers keep their own data.
const MIGRATION = "drizzle/migrations/0052_owner_only_platform_finance.sql";
const read = (path: string) => readFileSync(path, "utf8");
const functions = (path: string, names: string[]) => {
  const source = read(path);
  return names.map((name) => {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    if (start < 0) throw new Error(`Missing function ${name}`);
    const rest = source.slice(start);
    const match = rest.match(/AS (\$[\w]*\$)/);
    if (!match || match.index === undefined) throw new Error(`Missing body ${name}`);
    const end = rest.indexOf(match[1], match.index + match[0].length);
    return rest.slice(0, end + match[1].length + 1);
  }).join("\n");
};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, SUPERVISOR = 2, SELLER = 3, BUYER = 4, OTHER_SELLER = 5;
let db: PGlite;
const asUser = async (n: number) => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(n)}',false); SET ROLE authenticated;`);
const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);

describe("owner-only platform finance (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TYPE app_role AS ENUM ('customer','vendor','moderator','admin','super_admin');
      CREATE TABLE user_roles(user_id uuid,role app_role,UNIQUE(user_id,role));
      CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text);
      CREATE TABLE coupons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text,vendor_id uuid,discount_type text DEFAULT 'percentage',discount_value numeric DEFAULT 10,min_purchase numeric,max_uses int,used_count int DEFAULT 0,expires_at timestamptz,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now());
      CREATE TABLE coupon_redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coupon_id uuid,customer_id uuid,vendor_id uuid,units int DEFAULT 1,status text DEFAULT 'used');
      CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid,status text);
      CREATE TABLE order_items(order_id uuid,vendor_id uuid);
      CREATE TABLE order_status_history(order_id uuid,status text,created_at timestamptz DEFAULT now());
      CREATE TABLE returns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,vendor_id uuid,customer_id uuid);
      CREATE TABLE vendor_ratings(vendor_id uuid,rating numeric);
      CREATE TABLE payout_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid,amount numeric,status text DEFAULT 'pending');
      CREATE TABLE payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,amount numeric);
      CREATE TABLE payment_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid);
      CREATE TABLE payment_webhook_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE FUNCTION public.has_any_admin_role(_user_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role IN ('admin','super_admin','moderator')) $$;
      CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role=_role) $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT UPDATE ON payout_requests TO authenticated;
      ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
      -- Pre-migration rule shapes (supervisors allowed), replaced by the migration below.
      CREATE POLICY "payouts_admin_select" ON payout_requests FOR SELECT USING (has_any_admin_role(auth.uid()));
      CREATE POLICY "payouts_admin_update" ON payout_requests FOR UPDATE USING (has_any_admin_role(auth.uid())) WITH CHECK (has_any_admin_role(auth.uid()));
      CREATE POLICY "payouts_vendor_select_own" ON payout_requests FOR SELECT USING (vendor_id = auth.uid());
      CREATE POLICY "Redemptions visible to buyer, seller and admins" ON coupon_redemptions FOR SELECT USING ((customer_id = auth.uid()) OR (vendor_id = auth.uid()) OR has_any_admin_role(auth.uid()));
      CREATE POLICY "Admins can view all payments" ON payments FOR SELECT USING (has_any_admin_role(auth.uid()));
      CREATE POLICY "Users can view their order payments" ON payments FOR SELECT USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.customer_id = auth.uid()));
      CREATE POLICY "Admins can view all payment transactions" ON payment_transactions FOR SELECT USING (has_any_admin_role(auth.uid()));
      CREATE POLICY "Admins can view payment webhook events" ON payment_webhook_events FOR SELECT USING (has_any_admin_role(auth.uid()));
      CREATE POLICY "Admins can view all returns" ON returns FOR SELECT USING (has_any_admin_role(auth.uid()));
    `);
    await db.exec(functions(MIGRATION, ["get_seller_performance", "seller_coupon_stats", "admin_list_coupons"]));
    const policies = read(MIGRATION).split("\n").filter((line) => line.startsWith("ALTER POLICY")).join("\n");
    expect(policies.split("\n")).toHaveLength(7);
    await db.exec(policies);
    await db.exec(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;`);
  }, 30000);
  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec(`RESET ROLE;
      TRUNCATE user_roles, coupons, coupon_redemptions, orders, payout_requests, payments, payment_transactions, payment_webhook_events, returns;
      INSERT INTO user_roles VALUES ('${id(OWNER)}','super_admin'),('${id(SUPERVISOR)}','moderator'),('${id(SUPERVISOR)}','vendor'),('${id(SELLER)}','vendor'),('${id(OTHER_SELLER)}','vendor');
      INSERT INTO coupons(code,vendor_id) VALUES ('SELLER10','${id(SELLER)}'),('OTHER10','${id(OTHER_SELLER)}');
      INSERT INTO orders(id,customer_id,status) VALUES ('${id(100)}','${id(BUYER)}','delivered'),('${id(101)}','${id(9)}','delivered');
      INSERT INTO coupon_redemptions(coupon_id,customer_id,vendor_id) SELECT id,'${id(BUYER)}',vendor_id FROM coupons;
      INSERT INTO payout_requests(vendor_id,amount) VALUES ('${id(SELLER)}',100),('${id(OTHER_SELLER)}',200);
      INSERT INTO payments(order_id,amount) VALUES ('${id(100)}',50),('${id(101)}',70);
      INSERT INTO payment_transactions(order_id) VALUES ('${id(100)}');
      INSERT INTO payment_webhook_events DEFAULT VALUES;
      INSERT INTO returns(order_id,vendor_id,customer_id) VALUES ('${id(100)}','${id(SELLER)}','${id(BUYER)}');`);
  });

  it("refuses supervisors every platform-wide finance read and payout change", async () => {
    await asUser(SUPERVISOR);
    await expect(db.query(`SELECT * FROM admin_list_coupons()`)).rejects.toThrow(/not_authorized/);
    await expect(db.query(`SELECT * FROM get_seller_performance('${id(SELLER)}')`)).rejects.toThrow(/not_authorized/);
    expect(await count(`SELECT count(*)::int n FROM seller_coupon_stats()`)).toBe(0);
    for (const table of ["payout_requests", "coupon_redemptions", "payments", "payment_transactions", "payment_webhook_events", "returns"]) {
      expect(await count(`SELECT count(*)::int n FROM ${table}`)).toBe(0);
    }
    const updated = await db.query(`UPDATE payout_requests SET status='approved' RETURNING id`);
    expect(updated.rows).toHaveLength(0);
  });

  it("gives the platform owner full platform-wide finance access", async () => {
    await asUser(OWNER);
    expect((await db.query(`SELECT * FROM admin_list_coupons()`)).rows).toHaveLength(2);
    expect((await db.query(`SELECT * FROM get_seller_performance('${id(SELLER)}')`)).rows).toHaveLength(1);
    expect(await count(`SELECT count(*)::int n FROM seller_coupon_stats()`)).toBe(2);
    expect(await count(`SELECT count(*)::int n FROM payout_requests`)).toBe(2);
    expect(await count(`SELECT count(*)::int n FROM coupon_redemptions`)).toBe(2);
    expect(await count(`SELECT count(*)::int n FROM payments`)).toBe(2);
    expect(await count(`SELECT count(*)::int n FROM payment_transactions`)).toBe(1);
    expect(await count(`SELECT count(*)::int n FROM payment_webhook_events`)).toBe(1);
    expect(await count(`SELECT count(*)::int n FROM returns`)).toBe(1);
    expect((await db.query(`UPDATE payout_requests SET status='approved' RETURNING id`)).rows).toHaveLength(2);
  });

  it("keeps sellers' and buyers' access to their own finance data", async () => {
    await asUser(SELLER);
    expect((await db.query(`SELECT * FROM get_seller_performance()`)).rows).toHaveLength(1);
    await expect(db.query(`SELECT * FROM get_seller_performance('${id(OTHER_SELLER)}')`)).rejects.toThrow(/not_authorized/);
    expect(await count(`SELECT count(*)::int n FROM seller_coupon_stats()`)).toBe(1);
    expect(await count(`SELECT count(*)::int n FROM payout_requests`)).toBe(1);
    expect(await count(`SELECT count(*)::int n FROM coupon_redemptions`)).toBe(1);
    await asUser(BUYER);
    expect(await count(`SELECT count(*)::int n FROM payments`)).toBe(1);
    expect(await count(`SELECT count(*)::int n FROM coupon_redemptions`)).toBe(2);
  });
});
