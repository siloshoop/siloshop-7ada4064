// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { canAccessAdminModule } from "@/components/admin/adminModules";
import {
  clickThroughRate, isLiveCarouselAd, normalizeCarouselSettings, priceFields, trackCarouselEvent,
  validateCarouselAd, validateSlideSeconds, type CarouselAdForm,
} from "@/lib/homeCarousel";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, ADMIN = 2, MODERATOR = 3, CUSTOMER = 4;
let db: PGlite;
const as = async (n: number | null) => db.exec(n === null
  ? `RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE anon`
  : `RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const insertAd = (title: string) => db.query(`INSERT INTO native_ads(title,placement) VALUES($1,'home_carousel') RETURNING id`, [title]);
const tracked: unknown[] = [];
// Never send test tracking events to the real backend.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: (row: unknown) => { tracked.push(row); return Promise.resolve({ error: null }); } }) },
}));

describe("homepage carousel ads (database rules)", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND (role=$2 OR role='super_admin' AND $2 IN ('admin','moderator') OR role='admin' AND $2='moderator')) $$;
      CREATE TABLE native_ads(id uuid primary key default gen_random_uuid(),title text not null,description text,image_url text,cta_text text not null default 'x',cta_url text,sponsor_name text not null default 'x',placement text not null default 'search',priority int not null default 0,is_active boolean not null default true,start_date timestamptz default now(),end_date timestamptz,created_at timestamptz not null default now());
      ALTER TABLE native_ads ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON native_ads TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON native_ads TO authenticated;
      CREATE POLICY public_live ON native_ads FOR SELECT USING (is_active AND (start_date IS NULL OR start_date<=now()) AND (end_date IS NULL OR end_date>now()));
      -- stands in for the delegated ads.manage staff policies (admins and permitted supervisors)
      CREATE POLICY staff_all ON native_ads FOR ALL TO authenticated USING (public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'moderator'));
      CREATE TABLE ad_analytics(id uuid primary key default gen_random_uuid(),ad_slot text not null,event_type text not null default 'impression',user_id uuid,session_id text,page_url text,created_at timestamptz not null default now());`);
    for (const file of ["0049_owner_home_carousel_ads.sql", "0050_carousel_price_requires_currency.sql"]) {
      await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/--> statement-breakpoint/g, ""));
    }
    await db.exec(`CREATE TRIGGER validate_admin_ad_before_write BEFORE INSERT OR UPDATE OF placement,start_date,end_date,cta_url ON native_ads FOR EACH ROW EXECUTE FUNCTION public.validate_admin_ad();
      INSERT INTO user_roles VALUES('${id(OWNER)}','super_admin'),('${id(ADMIN)}','admin'),('${id(MODERATOR)}','moderator'),('${id(CUSTOMER)}','customer');`);
  }, 30000);
  beforeEach(async () => { await db.exec(`RESET ROLE; DELETE FROM native_ads; DELETE FROM ad_analytics; DELETE FROM home_carousel_settings;`); });
  afterAll(async () => { await db?.close(); });

  it("owner can add, edit, deactivate, activate and delete a carousel ad", async () => {
    await as(OWNER);
    const { rows } = await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement,price,currency,cta_url,priority) VALUES('Build&Learn','home_carousel',330000,'SYP','/product/abc',1) RETURNING id`);
    const adId = rows[0].id;
    await db.query(`UPDATE native_ads SET title='edited',description='d',price=12,currency='USD',priority=2,start_date='2026-01-01',end_date='2030-01-01' WHERE id=$1`, [adId]);
    await db.query(`UPDATE native_ads SET is_active=false WHERE id=$1`, [adId]);
    expect((await db.query<{ title: string; is_active: boolean }>(`SELECT title,is_active FROM native_ads WHERE id=$1`, [adId])).rows[0]).toEqual({ title: "edited", is_active: false });
    await db.query(`UPDATE native_ads SET is_active=true WHERE id=$1`, [adId]);
    await db.query(`DELETE FROM native_ads WHERE id=$1`, [adId]);
    expect((await db.query(`SELECT 1 FROM native_ads WHERE id=$1`, [adId])).rows).toHaveLength(0);
  });

  it("only the owner can see (and so remove) uploaded ad pictures in storage", async () => {
    await db.exec(`RESET ROLE; CREATE SCHEMA IF NOT EXISTS storage; GRANT USAGE ON SCHEMA storage TO authenticated;
      CREATE TABLE IF NOT EXISTS storage.objects(bucket_id text, name text);
      CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT ON storage.objects TO authenticated; DELETE FROM storage.objects;
      INSERT INTO storage.objects VALUES('product-images','platform/banners/ad.png'),('product-images','platform/categories/c.png'),('store-assets','platform/banners/x.png');`);
    if (!(await db.query(`SELECT 1 FROM pg_policies WHERE policyname='owner_read_platform_banner_images'`)).rows.length)
      await db.exec(readFileSync("drizzle/migrations/0051_owner_read_platform_banner_images.sql", "utf8"));
    const visible = async (n: number) => { await as(n); return (await db.query<{ name: string }>(`SELECT name FROM storage.objects`)).rows.map((r) => r.name); };
    expect(await visible(OWNER)).toEqual(["platform/banners/ad.png"]);
    for (const other of [ADMIN, MODERATOR, CUSTOMER]) expect(await visible(other)).toEqual([]);
  });

  it("admins and permitted supervisors cannot create carousel ads", async () => {
    for (const actor of [ADMIN, MODERATOR, CUSTOMER]) {
      await as(actor);
      await expect(insertAd("denied")).rejects.toThrow("row-level security");
    }
  });

  it("admins cannot see carousel drafts, edit, delete or move them to another placement", async () => {
    await as(OWNER);
    const adId = (await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement,is_active) VALUES('draft','home_carousel',false) RETURNING id`)).rows[0].id;
    await as(ADMIN);
    expect((await db.query(`SELECT 1 FROM native_ads WHERE id=$1`, [adId])).rows).toHaveLength(0);
    expect((await db.query(`UPDATE native_ads SET title='x',placement='home' WHERE id=$1 RETURNING id`, [adId])).rows).toHaveLength(0);
    expect((await db.query(`DELETE FROM native_ads WHERE id=$1 RETURNING id`, [adId])).rows).toHaveLength(0);
    await as(OWNER);
    expect((await db.query<{ title: string; placement: string }>(`SELECT title,placement FROM native_ads WHERE id=$1`, [adId])).rows[0]).toEqual({ title: "draft", placement: "home_carousel" });
  });

  it("admins cannot turn their own banner into a carousel ad, but still manage ordinary banners", async () => {
    await as(ADMIN);
    const adId = (await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement) VALUES('banner','home') RETURNING id`)).rows[0].id;
    await expect(db.query(`UPDATE native_ads SET placement='home_carousel' WHERE id=$1`, [adId])).rejects.toThrow("row-level security");
    await db.query(`UPDATE native_ads SET title='banner 2' WHERE id=$1`, [adId]);
    await db.query(`DELETE FROM native_ads WHERE id=$1`, [adId]);
  });

  it("visitors only see active carousel ads inside their scheduled dates", async () => {
    await as(OWNER);
    await db.exec(`INSERT INTO native_ads(title,placement,is_active,start_date,end_date) VALUES
      ('live','home_carousel',true,now()-interval '1 day',now()+interval '1 day'),
      ('open-ended','home_carousel',true,null,null),
      ('draft','home_carousel',false,null,null),
      ('scheduled','home_carousel',true,now()+interval '1 day',null),
      ('expired','home_carousel',true,now()-interval '2 day',now()-interval '1 day')`);
    for (const actor of [null, CUSTOMER, ADMIN]) {
      await as(actor);
      const titles = (await db.query<{ title: string }>(`SELECT title FROM native_ads WHERE placement='home_carousel' ORDER BY title`)).rows.map((r) => r.title);
      expect(titles).toEqual(["live", "open-ended"]);
    }
    await as(OWNER);
    expect((await db.query(`SELECT 1 FROM native_ads WHERE placement='home_carousel'`)).rows).toHaveLength(5);
  });

  it("a price needs a supported currency (USD or SYP) and cannot be negative", async () => {
    await as(OWNER);
    await expect(db.query(`INSERT INTO native_ads(title,placement,price) VALUES('x','home_carousel',5)`)).rejects.toThrow("native_ads_price_currency_required");
    await expect(db.query(`INSERT INTO native_ads(title,placement,price,currency) VALUES('x','home_carousel',5,'EUR')`)).rejects.toThrow("native_ads_price_currency");
    await expect(db.query(`INSERT INTO native_ads(title,placement,price,currency) VALUES('x','home_carousel',-1,'SYP')`)).rejects.toThrow("native_ads_price_nonnegative");
    await expect(db.query(`INSERT INTO native_ads(title,placement,cta_url) VALUES('x','home_carousel','https://evil.example')`)).rejects.toThrow("invalid_ad_destination");
  });

  it("only the owner changes autoplay and slide duration; everyone can read them", async () => {
    await as(OWNER);
    await db.query(`INSERT INTO home_carousel_settings(id,autoplay,slide_duration_ms) VALUES(1,false,6000) ON CONFLICT(id) DO UPDATE SET autoplay=EXCLUDED.autoplay,slide_duration_ms=EXCLUDED.slide_duration_ms`);
    await expect(db.query(`UPDATE home_carousel_settings SET slide_duration_ms=500`)).rejects.toThrow();
    await as(ADMIN);
    expect((await db.query(`UPDATE home_carousel_settings SET autoplay=true RETURNING id`)).rows).toHaveLength(0);
    await as(null);
    expect((await db.query<{ autoplay: boolean; slide_duration_ms: number }>(`SELECT autoplay,slide_duration_ms FROM home_carousel_settings`)).rows[0]).toEqual({ autoplay: false, slide_duration_ms: 6000 });
  });

  it("impressions and clicks are counted per ad and visible to the owner only", async () => {
    await as(OWNER);
    const a = (await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement) VALUES('a','home_carousel') RETURNING id`)).rows[0].id;
    const b = (await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement) VALUES('b','home_carousel') RETURNING id`)).rows[0].id;
    await db.exec(`RESET ROLE; INSERT INTO ad_analytics(ad_slot,event_type) VALUES
      ('home-carousel-${a}','impression'),('home-carousel-${a}','impression'),('home-carousel-${a}','impression'),('home-carousel-${a}','click'),
      ('home-carousel-${b}','impression'),('native-home-${a.slice(0, 8)}','impression')`);
    await as(OWNER);
    const stats = (await db.query<{ ad_id: string; impressions: string; clicks: string }>(`SELECT ad_id,impressions,clicks FROM admin_home_carousel_ad_stats()`)).rows;
    const byId = Object.fromEntries(stats.map((s) => [s.ad_id, [Number(s.impressions), Number(s.clicks)]]));
    expect(byId[a]).toEqual([3, 1]);
    expect(byId[b]).toEqual([1, 0]);
    await as(ADMIN);
    await expect(db.query(`SELECT * FROM admin_home_carousel_ad_stats()`)).rejects.toThrow("not_authorized");
  });
});

describe("homepage carousel ads (app rules)", () => {
  const form = (over: Partial<CarouselAdForm> = {}): CarouselAdForm => ({
    title: "مكعبات", description: "", image_url: "/img.png", cta_url: "/product/1", price: "", currency: "",
    priority: 1, is_active: true, start_date: "", end_date: "", ...over,
  });

  it("only the owner sees the إدارة الإعلانات page", () => {
    expect(canAccessAdminModule("/admin/ads", "super_admin")).toBe(true);
    expect(canAccessAdminModule("/admin/ads", "admin")).toBe(false);
    expect(canAccessAdminModule("/admin/ads", "moderator", ["ads.view", "ads.manage"])).toBe(false);
  });

  it("requires a title, an image, an internal link and a currency with any price", () => {
    expect(validateCarouselAd(form())).toBeNull();
    expect(validateCarouselAd(form({ title: " " }))).toMatch("عنوان");
    expect(validateCarouselAd(form({ image_url: "" }))).toMatch("صورة");
    expect(validateCarouselAd(form({ cta_url: "https://example.com" }))).toMatch("مسارًا داخليًا");
    expect(validateCarouselAd(form({ price: "330000" }))).toMatch("عملة");
    expect(validateCarouselAd(form({ price: "-3", currency: "SYP" }))).toMatch("سعرًا");
    expect(priceFields(form({ price: "330000", currency: "SYP" }))).toEqual({ price: 330000, currency: "SYP" });
    expect(priceFields(form({ price: "", currency: "USD" }))).toEqual({ price: null, currency: null });
  });

  it("slide duration stays between 2 and 20 seconds", () => {
    expect(validateSlideSeconds(4.5)).toBeNull();
    expect(validateSlideSeconds(1)).not.toBeNull();
    expect(validateSlideSeconds(21)).not.toBeNull();
    expect(normalizeCarouselSettings(null)).toEqual({ autoplay: true, slide_duration_ms: 4500 });
    expect(normalizeCarouselSettings({ autoplay: false, slide_duration_ms: 100 })).toEqual({ autoplay: false, slide_duration_ms: 2000 });
  });

  it("an ad is live only when active and inside its dates", () => {
    const now = Date.parse("2026-11-08T12:00:00Z");
    expect(isLiveCarouselAd({ is_active: true, start_date: null, end_date: null }, now)).toBe(true);
    expect(isLiveCarouselAd({ is_active: false, start_date: null, end_date: null }, now)).toBe(false);
    expect(isLiveCarouselAd({ is_active: true, start_date: "2026-11-09T00:00:00Z", end_date: null }, now)).toBe(false);
    expect(isLiveCarouselAd({ is_active: true, start_date: null, end_date: "2026-11-08T11:00:00Z" }, now)).toBe(false);
  });

  it("an impression counts once per ad per visit; click-through rate is clicks over impressions", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(trackCarouselEvent("ad-1", "impression", storage)).toBe(true);
    expect(trackCarouselEvent("ad-1", "impression", storage)).toBe(false);
    expect(trackCarouselEvent("ad-2", "impression", storage)).toBe(true);
    expect(trackCarouselEvent("ad-2", "click", storage)).toBe(true);
    expect(trackCarouselEvent("ad-2", "click", storage)).toBe(true);
    expect(tracked).toHaveLength(4);
    expect(tracked[0]).toMatchObject({ ad_slot: "home-carousel-ad-1", event_type: "impression" });
    expect(clickThroughRate(200, 5)).toBe("2.5%");
    expect(clickThroughRate(0, 0)).toBe("—");
  });
});
