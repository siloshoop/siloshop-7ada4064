// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { localDayRange, parseAdVisitors } from "@/lib/adVisitors";

const tracked: Array<Record<string, unknown>> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: (row: Record<string, unknown>) => { tracked.push(row); return Promise.resolve({ error: null }); } }) },
}));
import { adVisitorId, trackCarouselEvent } from "@/lib/homeCarousel";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = 1, ADMIN = 2, MODERATOR = 3, BUYER = 4, OTHER = 5;
let db: PGlite;
let adId = "";
const as = async (n: number | null) => db.exec(n === null
  ? `RESET ROLE; SELECT set_config('test.uid','',false); SET ROLE anon`
  : `RESET ROLE; SELECT set_config('test.uid','${id(n)}',false); SET ROLE authenticated`);
const view = (session: string | null, at?: string, userCol?: string) =>
  db.query(`INSERT INTO ad_analytics(ad_slot,event_type,session_id${userCol ? ",user_id" : ""}${at ? ",created_at" : ""}) VALUES($1,'impression',$2${userCol ? ",$3" : ""}${at ? `,$${userCol ? 4 : 3}` : ""})`,
    [`home-carousel-${adId}`, session, ...(userCol ? [userCol] : []), ...(at ? [at] : [])]);
type Result = { r: unknown };
const visitors = async (from: string | null = null, to: string | null = null) =>
  parseAdVisitors((await db.query<Result>(`SELECT admin_home_carousel_ad_visitors($1,$2,$3) r`, [adId, from, to])).rows[0].r);

describe("ad visitor history (database rules)", () => {
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE user_roles(user_id uuid,role text);
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
      CREATE TABLE profiles(id uuid primary key, full_name text, avatar_url text, phone text);
      CREATE TABLE native_ads(id uuid primary key default gen_random_uuid(), title text, placement text);
      CREATE TABLE ad_analytics(id uuid primary key default gen_random_uuid(),ad_slot text not null,event_type text not null default 'impression',user_id uuid,session_id text,page_url text,created_at timestamptz not null default now());
      ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;
      GRANT INSERT ON ad_analytics TO anon, authenticated;
      CREATE POLICY ad_analytics_public_insert ON ad_analytics FOR INSERT TO anon, authenticated
        WITH CHECK (ad_slot IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
      INSERT INTO user_roles VALUES('${id(OWNER)}','super_admin'),('${id(ADMIN)}','admin'),('${id(MODERATOR)}','moderator'),('${id(BUYER)}','customer');
      INSERT INTO profiles VALUES('${id(BUYER)}','سنا','https://example.com/a.png','0999'),('${id(OTHER)}','  ',null,'0988');`);
    await db.exec(readFileSync("drizzle/migrations/0054_home_carousel_ad_visitors.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  beforeEach(async () => {
    await db.exec(`RESET ROLE; DELETE FROM ad_analytics; DELETE FROM native_ads;`);
    adId = (await db.query<{ id: string }>(`INSERT INTO native_ads(title,placement) VALUES('a','home_carousel') RETURNING id`)).rows[0].id;
  });
  afterAll(async () => { await db?.close(); });

  it("the server attaches the signed-in account; guests stay anonymous and nobody can pose as someone else", async () => {
    await as(BUYER);
    await view("browser-1");
    await view("browser-1b", undefined, id(OTHER)); // claimed someone else: stored as the real caller
    await as(null);
    await view("browser-2");
    await view("browser-3", undefined, id(BUYER)); // a guest claiming an account stays a guest
    await db.exec("RESET ROLE");
    const rows = (await db.query<{ user_id: string | null; session_id: string }>(`SELECT user_id,session_id FROM ad_analytics ORDER BY session_id`)).rows;
    expect(rows).toEqual([
      { user_id: id(BUYER), session_id: "browser-1" }, { user_id: id(BUYER), session_id: "browser-1b" },
      { user_id: null, session_id: "browser-2" }, { user_id: null, session_id: "browser-3" },
    ]);
  });

  it("counts total views and unique visitors separately; repeat views from one visitor count once", async () => {
    await as(BUYER);
    await view("b1"); await view("b1"); await view("b1-new-tab");
    await as(null);
    await view("guest-1"); await view("guest-1"); await view("guest-2");
    await db.exec(`RESET ROLE; INSERT INTO ad_analytics(ad_slot,event_type) VALUES('home-carousel-${adId}','impression'),('home-carousel-${adId}','click'),('home-carousel-other','impression')`);
    await as(OWNER);
    const r = await visitors();
    expect(r.summary).toEqual({ total_views: 7, unique_visitors: 3, signed_in_visitors: 1, guest_visitors: 2, untracked_views: 1 });
    expect(r.visits).toHaveLength(6);
  });

  it("shows the visitor's name and picture, and guests as guest visitors without personal details", async () => {
    await as(BUYER); await view("b1");
    await as(OTHER); await view("o1");
    await as(null); await view("g1");
    await as(OWNER);
    const r = await visitors();
    const named = r.visits.find((v) => v.full_name === "سنا");
    expect(named).toMatchObject({ is_guest: false, avatar_url: "https://example.com/a.png" });
    expect(r.visits.filter((v) => v.is_guest)).toEqual([expect.objectContaining({ full_name: null, avatar_url: null })]);
    expect(JSON.stringify(r)).not.toMatch(/0999|0988|00000000-0000/);
  });

  it("filters by date and keeps each ad's visitors separate", async () => {
    await db.exec("RESET ROLE");
    await view("g1", "2026-11-01T10:00:00Z"); await view("g2", "2026-11-05T10:00:00Z"); await view("g3", "2026-11-08T10:00:00Z");
    await db.query(`INSERT INTO ad_analytics(ad_slot,event_type,session_id) VALUES('home-carousel-00000000-0000-4000-8000-000000000099','impression','x')`);
    await as(OWNER);
    const r = await visitors("2026-11-04T00:00:00Z", "2026-11-06T00:00:00Z");
    expect(r.summary.total_views).toBe(1);
    expect(r.visits.map((v) => v.visited_at.slice(0, 10))).toEqual(["2026-11-05"]);
    expect((await visitors()).summary.total_views).toBe(3);
  });

  it("only the owner can read visitor history", async () => {
    await db.exec("RESET ROLE"); await view("g1");
    for (const actor of [ADMIN, MODERATOR, BUYER]) {
      await as(actor);
      await expect(db.query(`SELECT admin_home_carousel_ad_visitors($1)`, [adId])).rejects.toThrow("not_authorized");
    }
    await as(null);
    await expect(db.query(`SELECT admin_home_carousel_ad_visitors($1)`, [adId])).rejects.toThrow();
  });
});

describe("ad visitor history (app rules)", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("one browser keeps one random visitor id, so refreshes and new visits are the same visitor", () => {
    const local = memory();
    const first = adVisitorId(local);
    expect(first).toBeTruthy();
    expect(adVisitorId(local)).toBe(first);
    expect(adVisitorId(memory())).not.toBe(first);
    tracked.length = 0;
    trackCarouselEvent("ad-1", "impression", memory(), local);
    trackCarouselEvent("ad-1", "impression", memory(), local);
    expect(tracked.map((t) => t.session_id)).toEqual([first, first]);
    expect(tracked[0]).not.toHaveProperty("user_id");
  });

  it("a date filter includes the whole last day", () => {
    const r = localDayRange("2026-11-01", "2026-11-03");
    expect(new Date(r.to!).getTime() - new Date(r.from!).getTime()).toBe(3 * 24 * 3600 * 1000);
    expect(localDayRange("", "")).toEqual({ from: undefined, to: undefined });
  });
});
