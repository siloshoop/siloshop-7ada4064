// @vitest-environment node
/// <reference types="node" />
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { canAccessAdminModule } from "@/components/admin/adminModules";

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const as = async (role: string) => db.exec(`SET ROLE authenticated; SELECT set_config('test.role','${role}',false)`);
describe("owner category permissions against applied migration", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(9)}'::uuid $$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true)=$2 $$;
      CREATE TABLE categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,name_ar text NOT NULL,icon text,image_url text,is_active boolean NOT NULL DEFAULT true,sort_order int NOT NULL DEFAULT 0,parent_id uuid,updated_at timestamptz DEFAULT now());
      ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
      CREATE POLICY "Admins can manage categories" ON categories FOR ALL TO authenticated USING(has_role(auth.uid(),'admin'));
      CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING(true);`);
    await db.exec(readFileSync("drizzle/migrations/0040_owner_category_management.sql", "utf8"));
  }, 30000);
  beforeEach(async () => { await db.exec(`RESET ROLE; TRUNCATE categories; INSERT INTO categories(id,name,name_ar) VALUES('${id(1)}','first','أ'),('${id(2)}','second','ب')`); });
  afterAll(async () => { await db?.close(); });
  it("super_admin saves Arabic name, selected icon, color and optional image", async () => {
    await as('super_admin');
    await db.query(`INSERT INTO categories(name,name_ar,icon,color,image_url) VALUES('فئة جديدة','فئة جديدة','Laptop','sky','https://example.com/category.jpg')`);
    const { rows } = await db.query<{ name_ar: string; color: string; icon: string }>(`SELECT name_ar,color,icon FROM categories WHERE name_ar='فئة جديدة'`);
    expect(rows[0]).toEqual({ name_ar: 'فئة جديدة', color: 'sky', icon: 'Laptop' });
  });
  for (const role of ['admin', 'moderator', 'vendor', 'customer']) {
    it(`${role} cannot add or change categories`, async () => {
      await as(role);
      await expect(db.query(`INSERT INTO categories(name,name_ar) VALUES('x','غير مسموح')`)).rejects.toThrow('row-level security');
      const result = await db.query(`UPDATE categories SET name_ar='changed' WHERE id='${id(1)}' RETURNING id`);
      expect(result.rows).toHaveLength(0);
      await expect(db.query(`SELECT reorder_category('${id(1)}','down')`)).rejects.toThrow('not_authorized');
    });
  }
  it("reorders equal sort values atomically", async () => {
    await as('super_admin'); await db.query(`SELECT reorder_category('${id(2)}','up')`);
    const result = await db.query<{ id: string; sort_order: number }>('SELECT id,sort_order FROM categories ORDER BY sort_order');
    expect(result.rows).toEqual([{id:id(2),sort_order:0},{id:id(1),sort_order:1}]);
  });
  it("deactivation preserves the row and active lists exclude it", async () => {
    await as('super_admin'); await db.query(`UPDATE categories SET is_active=false WHERE id='${id(1)}'`);
    await db.exec('RESET ROLE; SET ROLE anon');
    expect((await db.query('SELECT id FROM categories')).rows).toHaveLength(2);
    expect((await db.query('SELECT id FROM categories WHERE is_active=true')).rows).toEqual([{id:id(2)}]);
  });
  it("category module is limited to the owner", () => {
    expect(canAccessAdminModule('/admin/categories','super_admin')).toBe(true);
    for (const role of ['admin','moderator','vendor','customer']) expect(canAccessAdminModule('/admin/categories',role)).toBe(false);
  });
});