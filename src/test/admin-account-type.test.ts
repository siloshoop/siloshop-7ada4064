// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, ADMIN = 2, MODERATOR = 3, SELLER = 4, BUYER = 5;
let db: PGlite;
const as = async (n: number | null) => db.exec(n === null
  ? `RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE anon`
  : `RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const setType = async (user: number, type: string) =>
  (await db.query<{ r: string }>(`SELECT admin_set_account_type($1,$2::user_role) r`, [id(user), type])).rows[0].r;
const saved = async (user: number) => {
  await db.exec(`RESET ROLE`);
  const role = (await db.query<{ role: string }>(`SELECT role::text FROM profiles WHERE id=$1`, [id(user)])).rows[0].role;
  const roles = (await db.query<{ role: string }>(`SELECT role::text FROM user_roles WHERE user_id=$1 ORDER BY role::text`, [id(user)])).rows.map((r) => r.role);
  return { role, roles };
};

describe("Owner changes an account between seller and customer", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public TO anon,authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TYPE public.app_role AS ENUM ('customer','vendor','admin','super_admin','moderator');
      CREATE TYPE public.user_role AS ENUM ('customer','vendor');
      CREATE TABLE public.user_roles(id serial, user_id uuid, role public.app_role, UNIQUE(user_id, role));
      CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
        SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND (role=$2 OR (role='super_admin' AND $2 IN ('admin','moderator')))) $$;
      CREATE TABLE public.profiles(id uuid primary key, role public.user_role NOT NULL DEFAULT 'customer');
      CREATE TABLE public.admin_audit_log(action text, target_id uuid, old_value jsonb, new_value jsonb);
      CREATE FUNCTION public.log_admin_action(_action text, _target_type text, _target_id uuid, _old_value jsonb, _new_value jsonb, _reason text) RETURNS void
        LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO public.admin_audit_log VALUES(_action,_target_id,_old_value,_new_value) $$;
      INSERT INTO public.profiles VALUES('${id(OWNER)}','vendor'),('${id(ADMIN)}','customer'),('${id(MODERATOR)}','customer'),('${id(SELLER)}','vendor'),('${id(BUYER)}','customer');
      INSERT INTO public.user_roles(user_id,role) VALUES('${id(OWNER)}','super_admin'),('${id(ADMIN)}','admin'),('${id(MODERATOR)}','moderator'),
        ('${id(SELLER)}','customer'),('${id(SELLER)}','vendor'),('${id(BUYER)}','customer');`);
    await db.exec(readFileSync("drizzle/migrations/0058_admin_set_account_type.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it("Seller → Customer is saved as customer and removes the seller permission", async () => {
    await as(OWNER);
    expect(await setType(SELLER, "customer")).toBe("customer");
    expect(await saved(SELLER)).toEqual({ role: "customer", roles: ["customer"] });
  });

  it("Customer → Seller is saved as seller and adds the seller permission", async () => {
    await as(OWNER);
    expect(await setType(BUYER, "vendor")).toBe("vendor");
    expect(await saved(BUYER)).toEqual({ role: "vendor", roles: ["customer", "vendor"] });
  });

  it("records each change in the admin log", async () => {
    await db.exec(`RESET ROLE`);
    const rows = (await db.query<{ action: string }>(`SELECT action FROM admin_audit_log`)).rows;
    expect(rows.filter((r) => r.action === "account_type_changed")).toHaveLength(2);
  });

  it("admins, supervisors, sellers and signed-out visitors cannot change account types", async () => {
    for (const actor of [ADMIN, MODERATOR, SELLER]) {
      await as(actor);
      await expect(setType(BUYER, "customer")).rejects.toThrow("not_authorized");
    }
    await as(null);
    await expect(setType(BUYER, "customer")).rejects.toThrow();
    expect((await saved(BUYER)).role).toBe("vendor");
  });

  it("the owner cannot change their own account type", async () => {
    await as(OWNER);
    await expect(setType(OWNER, "customer")).rejects.toThrow("cannot_target_self");
  });
});
