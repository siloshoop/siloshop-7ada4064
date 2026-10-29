// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { Blob as NodeBlob } from 'node:buffer';
const uid='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const pid='00000000-0000-4000-8000-000000000003';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text); CREATE TABLE storage.objects(bucket_id text,name text,owner uuid,owner_id text);
 CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,role text,updated_at timestamptz);
 CREATE TABLE user_roles(user_id uuid,role text);
 CREATE TABLE products(id uuid PRIMARY KEY,vendor_id uuid REFERENCES profiles ON DELETE CASCADE);
 CREATE TABLE seller_applications(id uuid,user_id uuid); CREATE TABLE orders(id uuid,customer_id uuid,vendor_id uuid,status text);
 CREATE TABLE order_items(id uuid,order_id uuid,product_id uuid REFERENCES products,vendor_id uuid REFERENCES profiles);
 CREATE TABLE returns(id uuid,vendor_id uuid,customer_id uuid,status text); CREATE TABLE payout_requests(vendor_id uuid,status text);
 CREATE FUNCTION normalize_order_status(text) RETURNS text LANGUAGE sql AS $$SELECT $1$$;
 CREATE TABLE conversations(id uuid PRIMARY KEY,vendor_id uuid,customer_id uuid);
 CREATE TABLE chat_audit_log(conversation_id uuid,actor_id uuid);
 CREATE TABLE vendor_followers(vendor_id uuid,user_id uuid); CREATE TABLE vendor_ratings(vendor_id uuid,user_id uuid);
 CREATE TABLE review_replies(vendor_id uuid); CREATE TABLE product_attribute_values(product_id uuid);
 CREATE TABLE showroom_items(product_id uuid,vendor_id uuid); CREATE TABLE saved_comparisons(product_ids uuid[]);
 CREATE TABLE notifications(user_id uuid,related_id uuid); CREATE TABLE reports(target_id uuid,report_type text);
 CREATE TABLE coupons(vendor_id uuid); CREATE TABLE seller_violations(vendor_id uuid); CREATE TABLE admin_audit_log(target_id uuid);
 CREATE TABLE messages(sender_id uuid,deleted_by uuid); CREATE TABLE message_attachments(uploaded_by uuid);
 CREATE TABLE cart_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE favorites(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE compare_items(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE saved_for_later(product_id uuid REFERENCES products ON DELETE CASCADE,user_id uuid);
 CREATE TABLE delivery_addresses(user_id uuid); CREATE TABLE notification_preferences(user_id uuid);
 CREATE TABLE product_questions(user_id uuid); CREATE TABLE reviews(user_id uuid);
 CREATE TABLE activity_logs(user_id uuid); CREATE TABLE newsletter_subscriptions(email text);
 GRANT USAGE ON SCHEMA public TO authenticated,service_role;`);
 await db.exec(readFileSync('/tmp/seller-deletion.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close()});
const seed=async()=>{
 await db.exec(`DELETE FROM seller_deletion_jobs; DELETE FROM order_items; DELETE FROM orders; DELETE FROM payout_requests; DELETE FROM returns; DELETE FROM products; DELETE FROM user_roles; DELETE FROM profiles; DELETE FROM auth.users; DELETE FROM storage.objects;
 INSERT INTO auth.users VALUES('${uid}','isolated@example.test'),('${other}','other@example.test'); INSERT INTO profiles(id,role) VALUES('${uid}','vendor'),('${other}','vendor'); INSERT INTO user_roles VALUES('${uid}','vendor'); INSERT INTO seller_applications VALUES(gen_random_uuid(),'${uid}'); INSERT INTO products VALUES('${pid}','${uid}');`);
};
it('reproduces original seller reference failure and blocks retained receipts before deletion',async()=>{
 await seed(); await db.exec(`INSERT INTO orders VALUES(gen_random_uuid(),'${other}','${uid}','completed'); INSERT INTO order_items VALUES(gen_random_uuid(),NULL,'${pid}','${uid}')`);
 await expect(db.exec(`DELETE FROM profiles WHERE id='${uid}'`)).rejects.toThrow(/foreign key/);
 await expect(db.query(`SELECT prepare_seller_deletion($1,'account')`,[uid])).rejects.toThrow('retention_review_required');
 expect((await db.query(`SELECT * FROM products WHERE id='${pid}'`)).rows).toHaveLength(1);
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
 await seed(); await db.exec(`INSERT INTO favorites VALUES('${pid}','${other}'); INSERT INTO product_attribute_values VALUES('${pid}'); INSERT INTO vendor_followers VALUES('${uid}','${other}');`);
 await db.query(`SELECT prepare_seller_deletion($1,'store')`,[uid]);
 await db.query(`SELECT finish_seller_deletion($1,'store')`,[uid]);
 for(const table of ['products','favorites','product_attribute_values','vendor_followers','seller_applications']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
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
