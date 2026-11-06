// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { canAccessAdminModule } from "@/components/admin/adminModules";
import { adDates, adState, isInternalAdPath, localAdDate } from "@/lib/adSchedule";
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const actor = async (n: number) => db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('test.uid','${id(n)}',false)`);
describe("server-scoped admin permissions", () => {
  beforeAll(async () => {
    db = new PGlite({fsBundle:new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob});
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth,public TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE profiles(id uuid primary key,role text,is_banned boolean default false,account_status text default 'active');
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE TABLE seller_applications(user_id uuid);
      CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND (role=$2 OR role='super_admin' AND $2 IN ('admin','moderator') OR role='admin' AND $2='moderator')) $$;
      CREATE FUNCTION log_admin_action(text,jsonb) RETURNS void LANGUAGE sql AS $$ SELECT $$;
      CREATE TABLE native_ads(id uuid primary key default gen_random_uuid(),title text,placement text,is_active boolean default true,start_date timestamptz,end_date timestamptz,cta_url text);
      ALTER TABLE native_ads ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON native_ads TO authenticated;`);
    const migration=readFileSync("drizzle/migrations/0046_central_admin_scoped_permissions.sql","utf8");
    await db.exec(migration.slice(0,migration.indexOf("CREATE FUNCTION public.admin_account_directory")));
    await db.exec(migration.slice(migration.indexOf("CREATE POLICY staff_read_native_ads"),migration.indexOf("CREATE POLICY delegated_ad_image_insert")));
    await db.exec(migration.slice(migration.indexOf("CREATE FUNCTION public.validate_admin_ad")));
    await db.exec(`INSERT INTO profiles(id,role) VALUES('${id(1)}','customer'),('${id(2)}','customer'),('${id(3)}','customer'),('${id(4)}','vendor'); INSERT INTO user_roles VALUES('${id(1)}','super_admin'),('${id(2)}','moderator'),('${id(3)}','customer'); INSERT INTO seller_applications VALUES('${id(4)}')`);
  },30000);
  beforeEach(async()=>{ await db.exec(`RESET ROLE; DELETE FROM staff_permissions; DELETE FROM native_ads; UPDATE profiles SET account_status='active'`); });
  afterAll(async()=>{await db?.close();});
  it("owner has all customer, seller and ad scopes",async()=>{
    await actor(1);
    for(const key of ["customers.view","customers.manage","sellers.view","sellers.manage","ads.view","ads.manage"]){expect((await db.query<{ok:boolean}>(`SELECT has_staff_permission($1) ok`,[key])).rows[0]?.ok).toBe(true);}
  });
  it("moderators get no additional scopes by default",async()=>{await actor(2);expect((await db.query<{v:string[]}>(`SELECT get_my_staff_permissions() v`)).rows[0]?.v).toEqual([]);});
  it("owner grants view only without management or cross-group access",async()=>{
    await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['customers.view'])`,[id(2)]);await actor(2);
    expect((await db.query<{v:string[]}>(`SELECT get_my_staff_permissions() v`)).rows[0]?.v).toEqual(['customers.view']);
    expect((await db.query<{ok:boolean}>(`SELECT can_manage_staff_account($1) ok`,[id(3)])).rows[0]?.ok).toBe(false);
  });
  it("supervisors cannot grant themselves permissions",async()=>{await actor(2);await expect(db.query(`SELECT set_staff_permissions($1,ARRAY['ads.manage'])`,[id(2)])).rejects.toThrow('not_authorized');});
  it("manage implies view and revocation is immediate",async()=>{
    await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['ads.manage'])`,[id(2)]);await actor(2);
    expect((await db.query<{ok:boolean}>(`SELECT has_staff_permission('ads.view') ok`)).rows[0]?.ok).toBe(true);
    await db.query(`INSERT INTO native_ads(title,placement) VALUES('test','home')`);
    await actor(1);await db.query(`SELECT set_staff_permissions($1,'{}')`,[id(2)]);await actor(2);
    await expect(db.query(`INSERT INTO native_ads(title,placement) VALUES('denied','home')`)).rejects.toThrow('row-level security');
  });
  it("ad view-only supervisors cannot create ads",async()=>{await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['ads.view'])`,[id(2)]);await actor(2);await expect(db.query(`INSERT INTO native_ads(title,placement) VALUES('denied','home')`)).rejects.toThrow('row-level security');});
  it("ad managers can create edit schedule deactivate reactivate and delete",async()=>{
    await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['ads.manage'])`,[id(2)]);await actor(2);
    await db.query(`INSERT INTO native_ads(id,title,placement) VALUES($1,'original','home')`,[id(8)]);
    await db.query(`UPDATE native_ads SET title='edited',placement='search',start_date='2026-11-05',end_date='2026-11-07',is_active=false WHERE id=$1`,[id(8)]);
    expect((await db.query(`SELECT title,placement,is_active FROM native_ads WHERE id=$1`,[id(8)])).rows).toEqual([{title:'edited',placement:'search',is_active:false}]);
    await db.query(`UPDATE native_ads SET is_active=true WHERE id=$1`,[id(8)]);
    expect((await db.query<{is_active:boolean}>(`SELECT is_active FROM native_ads WHERE id=$1`,[id(8)])).rows[0]?.is_active).toBe(true);
    await db.query(`DELETE FROM native_ads WHERE id=$1`,[id(8)]);expect((await db.query(`SELECT id FROM native_ads`)).rows).toEqual([]);
  });
  it("view-only ad readers cannot edit or delete",async()=>{
    await actor(1);await db.query(`INSERT INTO native_ads(id,title,placement) VALUES($1,'original','home')`,[id(8)]);await db.query(`SELECT set_staff_permissions($1,ARRAY['ads.view'])`,[id(2)]);await actor(2);
    expect((await db.query(`UPDATE native_ads SET title='unauthorized' WHERE id=$1 RETURNING id`,[id(8)])).rows).toEqual([]);
    expect((await db.query(`DELETE FROM native_ads WHERE id=$1 RETURNING id`,[id(8)])).rows).toEqual([]);
    expect((await db.query<{title:string}>(`SELECT title FROM native_ads`)).rows[0]?.title).toBe('original');
  });
  it("suspended supervisors lose delegated access",async()=>{await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['sellers.manage'])`,[id(2)]);await db.exec(`RESET ROLE;UPDATE profiles SET account_status='suspended' WHERE id='${id(2)}'`);await actor(2);expect((await db.query<{ok:boolean}>(`SELECT has_staff_permission('sellers.view') ok`)).rows[0]?.ok).toBe(false);});
  it("delegates cannot manage staff accounts",async()=>{await actor(1);await db.query(`SELECT set_staff_permissions($1,ARRAY['customers.manage','sellers.manage'])`,[id(2)]);await actor(2);expect((await db.query<{ok:boolean}>(`SELECT can_manage_staff_account($1) ok`,[id(1)])).rows[0]?.ok).toBe(false);expect((await db.query<{ok:boolean}>(`SELECT can_manage_staff_account($1) ok`,[id(4)])).rows[0]?.ok).toBe(true);});
  it("ad dates and placements are enforced on writes",async()=>{await actor(1);await expect(db.query(`INSERT INTO native_ads(placement) VALUES('unknown')`)).rejects.toThrow('invalid_ad_placement');await expect(db.query(`INSERT INTO native_ads(placement,start_date,end_date) VALUES('home','2026-11-05','2026-11-04')`)).rejects.toThrow('invalid_ad_dates');});
});
describe("admin scope navigation and ad scheduling",()=>{
  it("owner sees every requested management module",()=>{for(const path of ['/admin/buyers','/admin/sellers','/admin/stores','/admin/banners','/admin/roles'])expect(canAccessAdminModule(path,'super_admin')).toBe(true);});
  it("supervisor customer permission cannot open seller or role tools",()=>{expect(canAccessAdminModule('/admin/buyers','moderator',['customers.view'])).toBe(true);expect(canAccessAdminModule('/admin/sellers','moderator',['customers.view'])).toBe(false);expect(canAccessAdminModule('/admin/roles','moderator',['customers.manage'])).toBe(false);});
  it("ad end must follow start",()=>{expect(()=>adDates('2026-11-05T10:00','2026-11-05T09:00')).toThrow();expect(adDates('','')).toEqual({start_date:null,end_date:null});});
  it("editing dates preserves their instants",()=>{const iso='2026-11-05T10:00:00.000Z';expect(adDates(localAdDate(iso),'').start_date).toBe(iso);});
  it("ad duration reports scheduled active and expired states",()=>{const now=Date.parse('2026-11-05T10:00Z');expect(adState({is_active:true,start_date:'2026-11-05T11:00Z',end_date:null},now)).toBe('مجدول');expect(adState({is_active:true,start_date:null,end_date:'2026-11-05T09:00Z'},now)).toBe('منتهي');});
  it("ad destinations stay internal",()=>{expect(isInternalAdPath('/product/123')).toBe(true);for(const url of ['//external.test','/\\external.test','https://external.test','/x\n'])expect(isInternalAdPath(url)).toBe(false);});
});