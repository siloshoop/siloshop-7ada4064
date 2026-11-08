// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { Blob as NodeBlob } from 'node:buffer';
// Production-shaped references: orders cascade from profiles, sold items block product/profile removal.
const retentionMigration=process.env.RETENTION_MIGRATION ?? 'drizzle/migrations/'+readdirSync('drizzle/migrations').find((f)=>f.startsWith('0048_'));
const uid='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const pid='00000000-0000-4000-8000-000000000003';
const oid='00000000-0000-4000-8000-000000000004';
const cid='00000000-0000-4000-8000-000000000005';
const unsold='00000000-0000-4000-8000-000000000006';
const cid2='00000000-0000-4000-8000-000000000007';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text); CREATE TABLE storage.objects(bucket_id text,name text,owner uuid,owner_id text);
 CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,role text,updated_at timestamptz,full_name text,phone text,phone_normalized text,avatar_url text,account_status text DEFAULT 'active',status_reason text,status_changed_at timestamptz,status_changed_by uuid,is_banned boolean DEFAULT false,banned_at timestamptz,ban_reason text);
 CREATE TABLE user_roles(user_id uuid,role text);
 CREATE TABLE products(id uuid PRIMARY KEY,vendor_id uuid REFERENCES profiles ON DELETE CASCADE,moderation_status text DEFAULT 'approved',is_active boolean DEFAULT true,description text,short_description text,image_url text,images text[],video_url text,seo_title text,seo_description text,seo_keywords text,tags text[] DEFAULT '{}',updated_at timestamptz);
 CREATE TABLE seller_applications(id uuid,user_id uuid,reviewed_by uuid); CREATE TABLE orders(id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,vendor_id uuid,status text,phone text,shipping_address text,notes text,delivery_lat numeric,delivery_lng numeric,cancelled_by uuid,total_amount numeric);
 CREATE TABLE order_items(id uuid,order_id uuid,product_id uuid NOT NULL REFERENCES products,vendor_id uuid NOT NULL REFERENCES profiles,product_name text,price numeric);
 CREATE TABLE returns(id uuid,vendor_id uuid,customer_id uuid,status text); CREATE TABLE payout_requests(vendor_id uuid,status text,details text);
 CREATE FUNCTION normalize_order_status(text) RETURNS text LANGUAGE sql AS $$SELECT $1$$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT 'service_role'::text$$;
 CREATE TABLE conversations(id uuid PRIMARY KEY,vendor_id uuid,customer_id uuid,last_message_sender_id uuid);
 CREATE TABLE chat_audit_log(conversation_id uuid,actor_id uuid);
 CREATE TABLE vendor_followers(vendor_id uuid,user_id uuid); CREATE TABLE vendor_ratings(vendor_id uuid,user_id uuid);
 CREATE TABLE review_replies(vendor_id uuid); CREATE TABLE product_attribute_values(attribute_id uuid);
 CREATE TABLE showroom_items(product_id uuid,vendor_id uuid); CREATE TABLE saved_comparisons(product_ids uuid[]);
 CREATE TABLE notifications(user_id uuid,related_id uuid); CREATE TABLE reports(target_id uuid,report_type text,reporter_id uuid,resolved_by uuid);
 CREATE TABLE coupons(id uuid PRIMARY KEY,vendor_id uuid,is_active boolean DEFAULT true,updated_at timestamptz); CREATE TABLE coupon_redemptions(coupon_id uuid NOT NULL REFERENCES coupons ON DELETE CASCADE,vendor_id uuid,customer_id uuid,coupon_code text); CREATE TABLE seller_violations(vendor_id uuid); CREATE TABLE admin_audit_log(target_id uuid);
 CREATE TABLE messages(sender_id uuid,deleted_by uuid); CREATE TABLE message_attachments(uploaded_by uuid,conversation_id uuid,storage_path text);
 CREATE TABLE cart_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE favorites(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE compare_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE saved_for_later(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE delivery_addresses(user_id uuid); CREATE TABLE notification_preferences(user_id uuid);
 CREATE TABLE product_questions(user_id uuid,answered_by uuid,product_id uuid); CREATE TABLE reviews(user_id uuid,product_id uuid,image_url text,hidden_by uuid);
 CREATE TABLE recently_viewed(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid); CREATE TABLE wishlist_items(product_id uuid REFERENCES products ON DELETE CASCADE);
 CREATE TABLE daily_deals(product_id uuid REFERENCES products ON DELETE CASCADE); CREATE TABLE quantity_discounts(product_id uuid REFERENCES products ON DELETE CASCADE);
 CREATE TABLE activity_logs(user_id uuid); CREATE TABLE newsletter_subscriptions(email text);
 CREATE TABLE payments(order_id uuid REFERENCES orders ON DELETE CASCADE,amount numeric,currency text); CREATE TABLE order_status_history(order_id uuid REFERENCES orders ON DELETE CASCADE,status text);
 GRANT USAGE ON SCHEMA public TO authenticated,service_role;`);
 await db.exec(readFileSync('drizzle/migrations/0044_seller_permanent_deletion.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0045_seller_deletion_safe_cleanup_preflight.sql','utf8'));
 await db.exec(readFileSync(retentionMigration,'utf8'));
},30000);
afterAll(async()=>{await db?.close()});
const seed=async()=>{
 await db.exec(`DELETE FROM seller_deletion_jobs; DELETE FROM payments; DELETE FROM order_status_history; DELETE FROM coupon_redemptions; DELETE FROM coupons; DELETE FROM order_items; DELETE FROM orders; DELETE FROM payout_requests; DELETE FROM returns; DELETE FROM products; DELETE FROM user_roles; DELETE FROM profiles; DELETE FROM auth.users; DELETE FROM storage.objects;
 INSERT INTO auth.users VALUES('${uid}','isolated@example.test'),('${other}','other@example.test'); INSERT INTO profiles(id,role) VALUES('${uid}','vendor'),('${other}','vendor'); INSERT INTO user_roles VALUES('${uid}','vendor'); INSERT INTO seller_applications VALUES(gen_random_uuid(),'${uid}'); INSERT INTO products VALUES('${pid}','${uid}');`);
};
const soldOrder=`INSERT INTO products(id,vendor_id,image_url,description) VALUES('${unsold}','${uid}','u.jpg','x'); UPDATE products SET image_url='${uid}/a.jpg',images='{${uid}/a.jpg}',description='وصف' WHERE id='${pid}';
 INSERT INTO orders(id,customer_id,vendor_id,status,phone,shipping_address,notes,total_amount) VALUES('${oid}','${other}','${uid}','delivered','0991234567','دمشق - المزة','اتصل قبل التوصيل',50);
 INSERT INTO payments VALUES('${oid}',50,'SYP'); INSERT INTO order_status_history VALUES('${oid}','pending'),('${oid}','delivered');
 INSERT INTO order_items VALUES(gen_random_uuid(),'${oid}','${pid}','${uid}','مكنسة',25); INSERT INTO favorites VALUES('${pid}','${other}'); INSERT INTO cart_items VALUES('${pid}','${other}')`;
it('seller with finished sales deletes the account; sales stay as anonymous records',async()=>{
 await seed(); await db.exec(soldOrder+`; INSERT INTO payout_requests VALUES('${uid}','paid','bank details')`);
 await db.query(`SELECT prepare_seller_deletion($1,'account')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[uid]);
 expect((await db.query(`SELECT customer_id,vendor_id,status,phone FROM orders`)).rows).toEqual([{customer_id:other,vendor_id:uid,status:'delivered',phone:'0991234567'}]);
 expect((await db.query(`SELECT product_id,product_name,price FROM order_items`)).rows).toEqual([{product_id:pid,product_name:'مكنسة',price:'25'}]);
 expect((await db.query(`SELECT id,moderation_status,is_active,image_url,images,description FROM products`)).rows).toEqual([{id:pid,moderation_status:'archived',is_active:false,image_url:null,images:[],description:null}]);
 for(const table of ['favorites','cart_items','seller_applications']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT details FROM payout_requests`)).rows).toEqual([{details:null}]);
 expect((await db.query(`SELECT full_name,phone,role,account_status,status_reason FROM profiles WHERE id='${uid}'`)).rows).toEqual([{full_name:'حساب محذوف',phone:null,role:'customer',account_status:'suspended',status_reason:'account_deleted'}]);
});
it('buyer with delivered and cancelled orders deletes the account; seller keeps the sale without buyer contact details',async()=>{
 await seed(); await db.exec(soldOrder+`; INSERT INTO orders(id,customer_id,vendor_id,status,phone) VALUES(gen_random_uuid(),'${other}','${uid}','cancelled','0991234567'); UPDATE profiles SET full_name='سارة',phone='0999999999' WHERE id='${other}'`);
 await db.query(`SELECT prepare_seller_deletion($1,'account')`,[other]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[other]);
 expect((await db.query(`SELECT customer_id,vendor_id,phone,shipping_address,notes FROM orders ORDER BY status`)).rows).toEqual([
  {customer_id:other,vendor_id:uid,phone:null,shipping_address:null,notes:null},
  {customer_id:other,vendor_id:uid,phone:null,shipping_address:null,notes:null}]);
 expect((await db.query(`SELECT full_name,phone FROM profiles WHERE id='${other}'`)).rows).toEqual([{full_name:'حساب محذوف',phone:null}]);
 expect((await db.query(`SELECT moderation_status FROM products WHERE id='${pid}'`)).rows).toEqual([{moderation_status:'approved'}]);
});
it('seller who sold before deletes the store; past orders and coupon history stay while listings disappear',async()=>{
 await seed(); await db.exec(soldOrder+`; INSERT INTO coupons(id,vendor_id) VALUES('${cid}','${uid}'),('${cid2}','${uid}'); INSERT INTO coupon_redemptions VALUES('${cid}','${uid}','${other}','SAVE10')`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 expect((await db.query(`SELECT id,moderation_status,is_active FROM products`)).rows).toEqual([{id:pid,moderation_status:'archived',is_active:false}]);
 expect((await db.query(`SELECT customer_id,vendor_id,phone FROM orders`)).rows).toEqual([{customer_id:other,vendor_id:uid,phone:'0991234567'}]);
 expect((await db.query(`SELECT id,is_active FROM coupons`)).rows).toEqual([{id:cid,is_active:false}]);
 expect((await db.query(`SELECT coupon_id,coupon_code FROM coupon_redemptions`)).rows).toEqual([{coupon_id:cid,coupon_code:'SAVE10'}]);
 expect((await db.query(`SELECT role,full_name FROM profiles WHERE id='${uid}'`)).rows).toEqual([{role:'customer',full_name:null}]);
 expect((await db.query(`SELECT * FROM favorites`)).rows).toHaveLength(0);
});
it('a buyer without order history is still removed completely',async()=>{
 await seed(); await db.query(`SELECT prepare_seller_deletion($1,'account')`,[other]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[other]);
 expect((await db.query(`SELECT * FROM profiles WHERE id='${other}'`)).rows).toHaveLength(0);
});
it('seller in-flight orders block store and account deletion before any media removal',async()=>{
 await seed(); await db.exec(`INSERT INTO orders VALUES(gen_random_uuid(),'${other}','${uid}','shipped')`);
 for(const scope of ['store','account']) await expect(db.query('SELECT prepare_seller_deletion($1,$2)',[uid,scope])).rejects.toThrow('open_orders');
 expect((await db.query('SELECT * FROM seller_deletion_jobs')).rows).toHaveLength(0);
});
it('clients cannot target another seller through the server-only cleanup RPC',async()=>{
 await seed(); await db.exec('SET ROLE authenticated');
 await expect(db.query(`SELECT prepare_seller_deletion($1,'store')`,[other])).rejects.toThrow(/permission denied/); await db.exec('RESET ROLE');
});
it('store deletion removes actual store/products/buyer saved rows but preserves login and unrelated seller',async()=>{
 await seed(); await db.exec(`INSERT INTO favorites VALUES('${pid}','${other}'); INSERT INTO vendor_followers VALUES('${uid}','${other}');`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 for(const table of ['products','favorites','vendor_followers','seller_applications']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
 expect((await db.query('SELECT * FROM auth.users')).rows).toHaveLength(2);
 expect((await db.query(`SELECT role FROM profiles WHERE id='${uid}'`)).rows).toEqual([{role:'customer'}]);
 await expect(db.query(`SELECT finish_seller_deletion($1,'store')`,[uid])).resolves.toBeDefined();
});
it('media failure prevents database cleanup; inventory is exact-user only and retries resume',async()=>{
 await seed(); await db.exec(`INSERT INTO storage.objects VALUES('product-images','${uid}/a.jpg','${uid}','${uid}'),('product-images','${other}/b.jpg','${other}','${other}')`);
 const first=await db.query<{prepare_seller_deletion:{assets:unknown[]}}>(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 expect(first.rows[0]?.prepare_seller_deletion.assets).toEqual([{bucket:'product-images',path:uid+'/a.jpg'}]);
 await expect(db.query(`SELECT finish_seller_deletion($1,'store')`,[uid])).rejects.toThrow('storage_cleanup_failed');
 expect((await db.query('SELECT * FROM products')).rows).toHaveLength(1);
 await db.exec(`DELETE FROM storage.objects WHERE owner='${uid}'`); await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1);
});
it('account cleanup removes eligible personal rows and profile before final Auth API deletion',async()=>{
 await seed(); await db.exec(`INSERT INTO activity_logs VALUES('${uid}'); INSERT INTO delivery_addresses VALUES('${uid}'); INSERT INTO newsletter_subscriptions VALUES('isolated@example.test')`);
 await db.query(`SELECT prepare_seller_deletion($1,'account')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[uid]);
 for(const table of ['activity_logs','delivery_addresses','newsletter_subscriptions','products']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT * FROM profiles WHERE id='${uid}'`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT * FROM profiles WHERE id='${other}'`)).rows).toHaveLength(1);
});
it('prepared jobs block new products and orders while allowing unrelated seller activity',async()=>{
 await seed(); await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 await expect(db.exec(`INSERT INTO products VALUES(gen_random_uuid(),'${uid}')`)).rejects.toThrow('deletion_in_progress');
 await expect(db.exec(`INSERT INTO orders VALUES(gen_random_uuid(),'${other}','${uid}','pending')`)).rejects.toThrow('deletion_in_progress');
 await expect(db.exec(`INSERT INTO products VALUES(gen_random_uuid(),'${other}')`)).resolves.toBeDefined();
});
it('rollback-only preflight leaves products, media and the prepared stage unchanged',async()=>{
 await seed(); await db.exec(`INSERT INTO storage.objects VALUES('product-images','${uid}/preview.jpg','${uid}','${uid}')`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 await db.query(`SELECT validate_seller_deletion($1,'store')`,[uid]);
 expect((await db.query(`SELECT id FROM products WHERE id='${pid}'`)).rows).toHaveLength(1);
 expect((await db.query(`SELECT name FROM storage.objects`)).rows).toHaveLength(1);
 expect((await db.query(`SELECT stage FROM seller_deletion_jobs WHERE user_id='${uid}'`)).rows).toEqual([{stage:'prepared'}]);
});
it('shared attribute values survive and only deleted IDs are removed from saved comparisons',async()=>{
 await seed(); await db.exec(`INSERT INTO product_attribute_values VALUES('${other}'); INSERT INTO saved_comparisons VALUES(ARRAY['${pid}'::uuid,'${other}'::uuid])`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 expect((await db.query(`SELECT attribute_id FROM product_attribute_values WHERE attribute_id='${other}'`)).rows).toHaveLength(1);
 expect((await db.query(`SELECT product_ids FROM saved_comparisons WHERE '${other}'::uuid=ANY(product_ids)`)).rows).toEqual([{product_ids:[other]}]);
});
it('an in-flight buyer order still blocks account deletion before any inventory is prepared',async()=>{
 await seed(); await db.exec(`INSERT INTO orders(id,customer_id,vendor_id,status) VALUES(gen_random_uuid(),'${other}','${uid}','pending')`);
 await expect(db.query(`SELECT prepare_seller_deletion($1,'account')`,[other])).rejects.toThrow('open_orders');
 expect((await db.query(`SELECT * FROM seller_deletion_jobs`)).rows).toHaveLength(0);
});
it('inventories conversation-prefixed buyer attachments for removed seller conversations',async()=>{
 await seed(); await db.exec(`INSERT INTO conversations(id,vendor_id,customer_id) VALUES('${pid}','${uid}','${other}'); INSERT INTO message_attachments VALUES('${other}','${pid}','${pid}/buyer.pdf'); INSERT INTO storage.objects VALUES('chat-files','${pid}/buyer.pdf','${other}','${other}')`);
 const result=await db.query<{prepare_seller_deletion:{assets:unknown[]}}>(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 expect(result.rows[0]?.prepare_seller_deletion.assets).toEqual([{bucket:'chat-files',path:pid+'/buyer.pdf'}]);
});

const financialHistory=async()=>({
 order:(await db.query(`SELECT id,status,total_amount FROM orders`)).rows,
 items:(await db.query(`SELECT order_id,product_id,product_name,price FROM order_items`)).rows,
 payments:(await db.query(`SELECT order_id,amount,currency FROM payments`)).rows,
 history:(await db.query(`SELECT status FROM order_status_history ORDER BY status`)).rows,
});
const expectedHistory={
 order:[{id:oid,status:'delivered',total_amount:'50'}],
 items:[{order_id:oid,product_id:pid,product_name:'مكنسة',price:'25'}],
 payments:[{order_id:oid,amount:'50',currency:'SYP'}],
 history:[{status:'delivered'},{status:'pending'}],
};
for(const [label,who,scope] of [['seller account','seller','account'],['seller store','seller','store'],['buyer account','buyer','account']] as const){
 it(`${label} deletion keeps order totals, item price snapshots, payments and status history unchanged`,async()=>{
  await seed(); await db.exec(soldOrder);
  const target=who==='seller'?uid:other;
  await db.query('SELECT prepare_seller_deletion($1,$2)',[target,scope]);
  await db.query('SELECT finish_seller_deletion($1,$2)',[target,scope]);
  expect(await financialHistory()).toEqual(expectedHistory);
  // the login row is never removed by the database step; retained history keeps the person's anonymous placeholder
  expect((await db.query(`SELECT id FROM auth.users WHERE id=$1`,[target])).rows).toHaveLength(1);
  if(scope==='account') expect((await db.query(`SELECT full_name FROM profiles WHERE id=$1`,[target])).rows).toEqual([{full_name:'حساب محذوف'}]);
 });
}
