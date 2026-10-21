import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canAccessAdminModule } from "@/components/admin/adminModules";
import { orderChatSellers } from "@/lib/orderChatSellers";

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
let db: PGlite;
const asUser = async (n: number) => db.exec(`SELECT set_config('request.jwt.claim.sub','${id(n)}',false); SET ROLE authenticated;`);
const scalar = async (sql: string) => (await db.query<{ value: unknown }>(sql)).rows[0]?.value;

describe("existing moderator RBAC and secure chat (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
      CREATE TYPE app_role AS ENUM ('customer','vendor','moderator','admin','super_admin');
      CREATE TYPE user_role AS ENUM ('customer','vendor');
      CREATE TABLE profiles(id uuid PRIMARY KEY, role user_role DEFAULT 'customer', account_status text DEFAULT 'active',updated_at timestamptz);
      CREATE TABLE user_roles(user_id uuid,role app_role,UNIQUE(user_id,role));
      CREATE TABLE seller_applications(id uuid PRIMARY KEY,user_id uuid,status text,reviewed_at timestamptz,reviewed_by uuid,rejection_reason text,identity_document_url text,business_document_url text);
      CREATE TABLE products(id uuid PRIMARY KEY,vendor_id uuid,name text,product_type text DEFAULT 'seller',moderation_status text DEFAULT 'pending',is_active boolean DEFAULT false,moderation_reason text,moderation_reason_code text,moderated_at timestamptz,moderated_by uuid,updated_at timestamptz);
      CREATE TABLE orders(id uuid PRIMARY KEY,customer_id uuid,vendor_id uuid,parent_order_id uuid,order_number text);
      CREATE TABLE order_items(order_id uuid,vendor_id uuid,product_id uuid);
      CREATE TABLE conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid,vendor_id uuid,admin_id uuid,admin_joined_at timestamptz,product_id uuid,order_id uuid,return_id uuid,context_type text,subject text,created_at timestamptz DEFAULT now(),is_blocked boolean DEFAULT false,is_suspended boolean DEFAULT false,suspended_until timestamptz);
      CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,sender_id uuid,content text,message_type text,reply_to_id uuid,file_url text,file_name text,metadata jsonb);
      CREATE TABLE conversation_participants(conversation_id uuid,user_id uuid,role text,UNIQUE(conversation_id,user_id));
      CREATE TABLE message_attachments(message_id uuid,conversation_id uuid,uploaded_by uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width int,height int,kind text);
      CREATE TABLE chat_audit_log(conversation_id uuid,message_id uuid,actor_id uuid,action text,metadata jsonb);
      CREATE TABLE notifications(user_id uuid,title text,message text,type text,related_id uuid);
      CREATE TABLE product_moderation_log(product_id uuid,action text,reason text,performed_by uuid,from_status text,to_status text);
      CREATE TABLE storage.objects(bucket_id text,name text);
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
      CREATE FUNCTION public.has_any_admin_role(_user_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role IN ('admin','super_admin','moderator')) $$;
      CREATE FUNCTION public.log_admin_action(text,text,uuid,jsonb,jsonb,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
      GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT SELECT ON storage.objects TO authenticated;
      GRANT INSERT,UPDATE,DELETE ON conversations,messages,conversation_participants TO authenticated;
      ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE products ENABLE ROW LEVEL SECURITY;
      ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_roles ON user_roles FOR SELECT USING(user_id=auth.uid());
      CREATE POLICY own_apps ON seller_applications FOR SELECT USING(user_id=auth.uid());
      CREATE POLICY product_review ON products FOR SELECT USING(has_any_admin_role(auth.uid()));
      CREATE POLICY conversation_members ON conversations FOR SELECT USING(customer_id=auth.uid() OR vendor_id=auth.uid());
      CREATE POLICY message_members ON messages FOR SELECT USING(EXISTS(SELECT 1 FROM conversations WHERE id=conversation_id AND (customer_id=auth.uid() OR vendor_id=auth.uid())));
    `);
    await db.exec(functions("supabase/migrations/20260818185005_048d35ad-3ec4-4d23-ad80-c76c600d445b.sql", ["has_role", "actor_admin_role", "admin_set_user_role"]));
    await db.exec(functions("supabase/migrations/20260721193842_f7c25cc2-b9ae-4ca9-b960-1f433796303e.sql", ["approve_seller_application", "reject_seller_application", "suspend_seller"]));
    await db.exec(functions("drizzle/migrations/0004_enforce_product_approval_workflow.sql", ["admin_moderate_product"]));
    await db.exec(functions("supabase/migrations/20260831184332_bfe86da5-38e7-473f-ad73-1f99bcb99de8.sql", ["start_conversation"]));
    await db.exec(functions("supabase/migrations/20260822060306_e030cec2-f532-4550-b8fd-5343eae7c709.sql", ["send_chat_message"]));
    await db.exec(read("drizzle/migrations/0037_existing_moderator_approvals_secure_chat.sql"));
    await db.exec(read("drizzle/migrations/0038_simplify_validated_chat_entry.sql"));
  }, 30000);
  beforeEach(async () => {
    await db.exec(`RESET ROLE; TRUNCATE profiles,user_roles,seller_applications,products,orders,order_items,conversations,messages,conversation_participants,notifications,product_moderation_log;
      INSERT INTO profiles(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6) n;
      INSERT INTO user_roles VALUES('${id(1)}','moderator'),('${id(2)}','customer'),('${id(3)}','vendor'),('${id(4)}','vendor'),('${id(5)}','super_admin');
      INSERT INTO seller_applications(id,user_id,status) VALUES('${id(11)}','${id(6)}','pending'),('${id(12)}','${id(3)}','approved'),('${id(13)}','${id(4)}','approved');
      INSERT INTO products(id,vendor_id,name,moderation_status,is_active) VALUES('${id(21)}','${id(3)}','one','pending',false),('${id(22)}','${id(3)}','two','approved',true),('${id(23)}','${id(4)}','three','approved',true);
      INSERT INTO products(id,vendor_id,name,product_type) VALUES('${id(24)}','${id(3)}','platform','platform');
      INSERT INTO orders VALUES('${id(31)}','${id(2)}',NULL,NULL,'parent'),('${id(32)}','${id(2)}','${id(3)}','${id(31)}','child');
      INSERT INTO order_items VALUES('${id(31)}','${id(3)}','${id(22)}'),('${id(31)}','${id(4)}','${id(23)}');`);
  });
  afterAll(async () => { await db?.close(); });
  it("moderator reviews applications through RLS", async () => {
    await asUser(1); expect(await scalar("SELECT count(*)::int AS value FROM seller_applications")).toBe(3);
  });
  it("moderator approves seller and grants only the existing vendor role", async () => {
    await asUser(1); await db.query(`SELECT approve_seller_application('${id(11)}')`);
    expect(await scalar(`SELECT status AS value FROM seller_applications WHERE id='${id(11)}'`)).toBe("approved");
    await db.exec("RESET ROLE"); expect(await scalar(`SELECT role::text AS value FROM user_roles WHERE user_id='${id(6)}'`)).toBe("vendor");
  });
  it("moderator rejects registration with the saved reason", async () => {
    await asUser(1); await db.query(`SELECT reject_seller_application('${id(11)}','documents')`);
    expect(await scalar(`SELECT rejection_reason AS value FROM seller_applications WHERE id='${id(11)}'`)).toBe("documents");
  });
  it("moderator cannot suspend a seller", async () => {
    await asUser(1); await expect(db.query(`SELECT suspend_seller('${id(3)}','reason')`)).rejects.toThrow("not_authorized");
  });
  it("moderator cannot reject an already approved store", async () => {
    await asUser(1); await expect(db.query(`SELECT reject_seller_application('${id(12)}','reason')`)).rejects.toThrow("not_authorized");
  });
  it.each([['approve','approved',true],['reject','rejected',false],['hide','hidden',false]] as const)("moderator can %s seller products", async (action,status,active) => {
    await asUser(1); await db.query(`SELECT admin_moderate_product('${id(21)}','${action}','reason',NULL)`);
    expect((await db.query(`SELECT moderation_status,is_active FROM products WHERE id='${id(21)}'`)).rows[0]).toEqual({ moderation_status:status,is_active:active });
  });
  it("moderator cannot moderate platform products", async () => {
    await asUser(1); await expect(db.query(`SELECT admin_moderate_product('${id(24)}','approve')`)).rejects.toThrow("not_authorized");
  });
  it("moderator cannot manage roles", async () => {
    await asUser(1); await expect(db.query(`SELECT admin_set_user_role('${id(2)}','super_admin',true,NULL)`)).rejects.toThrow("not_authorized");
  });
  it("super admin retains role management", async () => {
    await asUser(5); await db.query(`SELECT admin_set_user_role('${id(2)}','moderator',true,NULL)`);
    await db.exec("RESET ROLE"); expect(await scalar(`SELECT count(*)::int AS value FROM user_roles WHERE user_id='${id(2)}' AND role='moderator'`)).toBe(1);
  });
  it("customer cannot approve sellers or products", async () => {
    await asUser(2); await expect(db.query(`SELECT approve_seller_application('${id(11)}')`)).rejects.toThrow("not_authorized");
    await expect(db.query(`SELECT admin_moderate_product('${id(21)}','approve')`)).rejects.toThrow("not_authorized");
  });
  it("listed-product chat reuses its saved conversation", async () => {
    await asUser(2); const a=await scalar(`SELECT start_conversation('${id(3)}','${id(22)}') AS value`);
    expect(await scalar(`SELECT get_or_create_conversation('${id(3)}','${id(22)}') AS value`)).toBe(a);
  });
  it("current and legacy chat reject spoofed product sellers", async () => {
    await asUser(2);
    for (const fn of ['start_conversation','get_or_create_conversation']) await expect(db.query(`SELECT ${fn}('${id(4)}','${id(22)}')`)).rejects.toThrow("product_vendor_mismatch");
  });
  it("unlisted product cannot open a product chat", async () => {
    await asUser(2); await expect(db.query(`SELECT start_conversation('${id(3)}','${id(21)}')`)).rejects.toThrow("product_not_available");
  });
  it("buyer can contact each saved seller, including parent-held child-order items", async () => {
    await asUser(2);
    for (const [vendor,order] of [[3,31],[4,31],[3,32]]) expect(await scalar(`SELECT start_conversation('${id(vendor)}',NULL,'${id(order)}') AS value`)).toBeTypeOf("string");
  });
  it("order chat rejects unrelated sellers and other buyers", async () => {
    await asUser(2); await expect(db.query(`SELECT start_conversation('${id(6)}',NULL,'${id(31)}')`)).rejects.toThrow("not_authorized");
    await db.exec("RESET ROLE"); await asUser(6); await expect(db.query(`SELECT start_conversation('${id(3)}',NULL,'${id(31)}')`)).rejects.toThrow("order_not_found");
  });
  it("buyer and seller exchange messages; unrelated users see nothing and cannot send", async () => {
    await asUser(2); const c=await scalar(`SELECT start_conversation('${id(3)}','${id(22)}') AS value`);
    await db.query(`SELECT send_chat_message('${c}','buyer hello')`);
    await db.exec("RESET ROLE"); await asUser(3); await db.query(`SELECT send_chat_message('${c}','seller reply')`);
    expect(await scalar(`SELECT count(*)::int AS value FROM messages WHERE conversation_id='${c}'`)).toBe(2);
    await db.exec("RESET ROLE"); await asUser(4);
    expect(await scalar(`SELECT count(*)::int AS value FROM messages WHERE conversation_id='${c}'`)).toBe(0);
    await expect(db.query(`SELECT send_chat_message('${c}','intruder')`)).rejects.toThrow("not_authorized");
  });
  it("blocked thread prevents messages and direct table writes remain denied", async () => {
    await asUser(2); const c=await scalar(`SELECT start_conversation('${id(3)}','${id(22)}') AS value`);
    await db.exec(`RESET ROLE; UPDATE conversations SET is_blocked=true WHERE id='${c}'`); await asUser(2);
    await expect(db.query(`SELECT send_chat_message('${c}','blocked')`)).rejects.toThrow("conversation_unavailable");
    await expect(db.query(`INSERT INTO conversations(customer_id,vendor_id) VALUES('${id(2)}','${id(6)}')`)).rejects.toThrow("permission denied");
    await expect(db.query(`UPDATE conversation_participants SET role='admin'`)).rejects.toThrow("permission denied");
  });
  it("moderator navigation excludes role, finance and super-admin tools", () => {
    expect(canAccessAdminModule('/admin/products','moderator')).toBe(true);
    expect(canAccessAdminModule('/admin/seller-applications','moderator')).toBe(true);
    for (const href of ['/admin/roles','/admin/revenue','/admin/features','/admin/platform-products']) expect(canAccessAdminModule(href,'moderator')).toBe(false);
    expect(canAccessAdminModule('/admin/roles','super_admin')).toBe(true);
  });
  it("order support offers all distinct saved sellers", () => {
    expect(orderChatSellers([{vendor_id:id(3)},{vendor_id:id(4)},{vendor_id:id(3)},{vendor_id:null}])).toEqual([id(3),id(4)]);
  });
});