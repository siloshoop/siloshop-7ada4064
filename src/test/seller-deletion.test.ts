// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { Blob as NodeBlob } from 'node:buffer';
const retentionMigration=process.env.RETENTION_MIGRATION ?? 'drizzle/migrations/'+readdirSync('drizzle/migrations').find((f)=>f.startsWith('0048_'));
const uid='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const pid='00000000-0000-4000-8000-000000000003';
const oid='00000000-0000-4000-8000-000000000004';
const cid='00000000-0000-4000-8000-000000000005';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text); CREATE TABLE storage.objects(bucket_id text,name text,owner uuid,owner_id text);
 CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,role text,updated_at timestamptz);
 CREATE TABLE user_roles(user_id uuid,role text);
 CREATE TABLE products(id uuid PRIMARY KEY,vendor_id uuid REFERENCES profiles ON DELETE CASCADE);
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
 CREATE TABLE coupons(id uuid PRIMARY KEY,vendor_id uuid); CREATE TABLE coupon_redemptions(coupon_id uuid NOT NULL REFERENCES coupons ON DELETE CASCADE,vendor_id uuid,customer_id uuid,coupon_code text); CREATE TABLE seller_violations(vendor_id uuid); CREATE TABLE admin_audit_log(target_id uuid);
 CREATE TABLE messages(sender_id uuid,deleted_by uuid); CREATE TABLE message_attachments(uploaded_by uuid,conversation_id uuid,storage_path text);
 CREATE TABLE cart_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE favorites(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE compare_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE saved_for_later(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE delivery_addresses(user_id uuid); CREATE TABLE notification_preferences(user_id uuid);
 CREATE TABLE product_questions(user_id uuid,answered_by uuid); CREATE TABLE reviews(user_id uuid,product_id uuid,image_url text,hidden_by uuid);
 CREATE TABLE activity_logs(user_id uuid); CREATE TABLE newsletter_subscriptions(email text);
 GRANT USAGE ON SCHEMA public TO authenticated,service_role;`);
 await db.exec(readFileSync('drizzle/migrations/0044_seller_permanent_deletion.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0045_seller_deletion_safe_cleanup_preflight.sql','utf8'));
 await db.exec(readFileSync(retentionMigration,'utf8'));
},30000);
afterAll(async()=>{await db?.close()});
const seed=async()=>{
 await db.exec(`DELETE FROM seller_deletion_jobs; DELETE FROM coupon_redemptions; DELETE FROM coupons; DELETE FROM order_items; DELETE FROM orders; DELETE FROM payout_requests; DELETE FROM returns; DELETE FROM products; DELETE FROM user_roles; DELETE FROM profiles; DELETE FROM auth.users; DELETE FROM storage.objects;
 INSERT INTO auth.users VALUES('${uid}','isolated@example.test'),('${other}','other@example.test'); INSERT INTO profiles(id,role) VALUES('${uid}','vendor'),('${other}','vendor'); INSERT INTO user_roles VALUES('${uid}','vendor'); INSERT INTO seller_applications VALUES(gen_random_uuid(),'${uid}'); INSERT INTO products VALUES('${pid}','${uid}');`);
};
it('seller with finished sales deletes the account while sales records stay detached',async()=>{
 await seed(); await db.exec(`INSERT INTO orders(id,customer_id,vendor_id,status,phone) VALUES('${oid}','${other}','${uid}','delivered','0991234567'); INSERT INTO order_items VALUES(gen_random_uuid(),'${oid}','${pid}','${uid}','مكنسة',25); INSERT INTO payout_requests VALUES('${uid}','paid','bank details')`);
 await db.query(`SELECT prepare_seller_deletion($1,'account')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[uid]);
 expect((await db.query(`SELECT customer_id,vendor_id,status,phone FROM orders`)).rows).toEqual([{customer_id:other,vendor_id:null,status:'delivered',phone:'0991234567'}]);
 expect((await db.query(`SELECT product_id,vendor_id,product_name,price FROM order_items`)).rows).toEqual([{product_id:null,vendor_id:null,product_name:'مكنسة',price:'25'}]);
 expect((await db.query(`SELECT details FROM payout_requests`)).rows).toEqual([{details:null}]);
 expect((await db.query(`SELECT * FROM products`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT * FROM profiles WHERE id='${uid}'`)).rows).toHaveLength(0);
});
it('buyer with delivered and cancelled orders deletes the account; seller keeps the sale without buyer contact details',async()=>{
 await seed(); await db.exec(`INSERT INTO orders(id,customer_id,vendor_id,status,phone,shipping_address,notes,cancelled_by) VALUES('${oid}','${other}','${uid}','delivered','0991234567','دمشق - المزة','اتصل قبل التوصيل',NULL),(gen_random_uuid(),'${other}','${uid}','cancelled','0991234567','دمشق',NULL,'${other}'); INSERT INTO order_items VALUES(gen_random_uuid(),'${oid}','${pid}','${uid}','مكنسة',25)`);
 await db.query(`SELECT prepare_seller_deletion($1,'account')`,[other]); await db.query(`SELECT finish_seller_deletion($1,'account')`,[other]);
 expect((await db.query(`SELECT customer_id,vendor_id,phone,shipping_address,notes,cancelled_by FROM orders ORDER BY status`)).rows).toEqual([
  {customer_id:null,vendor_id:uid,phone:null,shipping_address:null,notes:null,cancelled_by:null},
  {customer_id:null,vendor_id:uid,phone:null,shipping_address:null,notes:null,cancelled_by:null}]);
 expect((await db.query(`SELECT product_id,vendor_id FROM order_items`)).rows).toEqual([{product_id:pid,vendor_id:uid}]);
 expect((await db.query(`SELECT * FROM profiles WHERE id='${other}'`)).rows).toHaveLength(0);
});
it('seller who sold before deletes the store; past orders and coupon history stay with snapshots',async()=>{
 await seed(); await db.exec(`INSERT INTO orders(id,customer_id,vendor_id,status) VALUES('${oid}','${other}','${uid}','delivered'); INSERT INTO order_items VALUES(gen_random_uuid(),'${oid}','${pid}','${uid}','مكنسة',25); INSERT INTO coupons VALUES('${cid}','${uid}'); INSERT INTO coupon_redemptions VALUES('${cid}','${uid}','${other}','SAVE10')`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]); await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 expect((await db.query(`SELECT * FROM products`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT customer_id,vendor_id FROM orders`)).rows).toEqual([{customer_id:other,vendor_id:uid}]);
 expect((await db.query(`SELECT product_id,product_name FROM order_items`)).rows).toEqual([{product_id:null,product_name:'مكنسة'}]);
 expect((await db.query(`SELECT coupon_id,coupon_code FROM coupon_redemptions`)).rows).toEqual([{coupon_id:null,coupon_code:'SAVE10'}]);
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
