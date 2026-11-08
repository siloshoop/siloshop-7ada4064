// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, ADMIN = 2, MODERATOR = 3, BUYER = 4;
let db: PGlite;
const as = async (n: number | null) => db.exec(n === null
  ? `RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE anon`
  : `RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const search = async (q: string) =>
  (await db.query<{ id: string }>(`SELECT admin_search_staff_by_email($1) id`, [q])).rows.map((r) => r.id).sort();

describe("Roles & Permissions email search", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public TO anon,authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TABLE auth.users(id uuid primary key, email text);
      CREATE TABLE public.user_roles(user_id uuid, role text);
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2) $$;
      INSERT INTO auth.users VALUES('${id(OWNER)}','owner@siloshop.net'),('${id(ADMIN)}','manager@example.com'),
        ('${id(MODERATOR)}','Jamil.Mod@Example.com'),('${id(BUYER)}','buyer_1@example.com');
      INSERT INTO public.user_roles VALUES('${id(OWNER)}','super_admin'),('${id(ADMIN)}','admin'),('${id(MODERATOR)}','moderator'),('${id(BUYER)}','customer');`);
    await db.exec(readFileSync("drizzle/migrations/0055_admin_staff_email_search.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it("the Super Admin finds staff accounts by part of their email, ignoring letter case", async () => {
    await as(OWNER);
    expect(await search("jamil.mod")).toEqual([id(MODERATOR)]);
    expect(await search("EXAMPLE.COM")).toEqual([id(ADMIN), id(MODERATOR)]);
    expect(await search("owner@siloshop.net")).toEqual([id(OWNER)]);
  });

  it("never returns non-staff accounts, and treats % and _ as plain characters", async () => {
    await as(OWNER);
    expect(await search("buyer")).toEqual([]);
    expect(await search("%%%")).toEqual([]);
    expect(await search("r_1@")).toEqual([]);
    expect(await search("ab")).toEqual([]);
  });

  it("admins, supervisors, buyers and signed-out visitors are refused", async () => {
    for (const actor of [ADMIN, MODERATOR, BUYER]) {
      await as(actor);
      await expect(search("example")).rejects.toThrow("not_authorized");
    }
    await as(null);
    await expect(search("example")).rejects.toThrow();
  });
});
