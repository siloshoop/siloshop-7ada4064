# السماح بحذف الحساب أو المتجر لمن لديه طلبات منتهية، مع الاحتفاظ بسجلات البيع

## المشكلة المؤكدة
- حاليًا يُرفض حذف الحساب أو المتجر لأي شخص لديه طلب سابق، حتى لو كانت كل طلباته مستلمة أو ملغاة. تظهر له رسالة «يلزم اعتماد سياسة الاحتفاظ القانونية» ولا يُحذف شيء.
- هذا المنع وُضع عمدًا كإجراء حماية مؤقت، لأن الطريقة القديمة كانت تمسح طلبات المشتري ومدفوعاته من سجلات البائعين أيضًا عند حذف حسابه، فتختفي مبيعات حقيقية من سجلاتهم.
- البائع الذي باع أي منتج لا يمكن حذف منتجاته أصلًا، لأن الطلبات القديمة ما زالت مربوطة بها.

## ما سيتغير
1. **الطلبات المفتوحة تبقى مانعة** كما هي الآن: لا حذف أثناء وجود طلب أو مرتجع أو مستحقات قيد التنفيذ.
2. **الطلبات المنتهية لم تعد تمنع الحذف** (تم الاستلام، ملغى، مرتجع، مسترد، فاشل)، وكذلك المرتجعات المغلقة والمستحقات المدفوعة أو المرفوضة.
3. **سجلات البيع تبقى** ولا تُحذف: رقم الطلب، التاريخ، المنتجات كما سُجّلت وقت الشراء (الاسم والصورة والسعر والكمية)، المبالغ والعملة، القسائم المستخدمة، الحالة وسجل التتبع.
4. **تُزال البيانات الشخصية للشخص المحذوف** من هذه السجلات: الاسم ورقم الهاتف وعنوان الشحن، ويظهر بدلها «حساب محذوف». يرى البائع طلباته القديمة كما هي لكن دون بيانات تواصل المشتري المحذوف.
5. **حذف متجر بائع باع سابقًا**: تُحذف منتجاته وصوره ومتجره وإعداداته، وتبقى طلباته القديمة كسجلات بيع منفصلة عن المنتج المحذوف، ولا يظهر أي منتج محذوف للمشترين.
6. **تحديث الرسائل**: تُزال رسالة «سياسة الاحتفاظ القانونية» من الحالة العادية، وتوضح شاشة التأكيد أن سجلات الطلبات المنتهية تُحفظ دون بيانات شخصية.
7. لا تغيير في الشكل أو الألوان أو بقية الميزات، ولا تغيير على الطلبات الحالية لأي شخص لا يحذف حسابه.

## قرار يحتاج تأكيدك
- الافتراض في هذه الخطة: إزالة الاسم والهاتف والعنوان **فورًا** عند الحذف، والاحتفاظ بسجل البيع دون مدة انتهاء. إن كان القانون أو سياستك تتطلب الاحتفاظ ببيانات المشتري لمدة محددة (مثلًا للفواتير)، أخبرني بالمدة قبل الموافقة.

## التحقق قبل الإبلاغ بالانتهاء
- اختبارات معزولة (دون لمس بيانات المتجر الحقيقية): مشتري بطلبات مستلمة يحذف حسابه بنجاح وتبقى سجلات البائع؛ بائع باع سابقًا يحذف متجره بنجاح؛ طلب مفتوح ما زال يمنع الحذف؛ البيانات الشخصية تُزال فعلًا؛ لا تظهر المنتجات المحذوفة في البحث أو القوائم.
- تشغيل الاختبارات الحالية للحذف والإدارة والتأكد من نجاح البناء.
- لن يُنفّذ حذف حقيقي على حساب فعلي، ولن يُختبر على Android فعليًا.

## Technical details
- New migration (additive, via migration tool):
  - `orders.customer_id`: drop NOT NULL and replace FK `ON DELETE CASCADE` with `ON DELETE SET NULL` (keeps buyer receipts when profile is removed). This is a schema-loosening change and may require the user's approval for the breaking-migration permission.
  - `order_items.product_id`: drop NOT NULL, FK -> `ON DELETE SET NULL`; `order_items.vendor_id` FK -> `ON DELETE SET NULL` (nullable). Snapshots `product_name/product_image/price/variant_label` already exist.
  - `returns.customer_id/vendor_id`, `coupon_redemptions.customer_id/vendor_id`, `coupon_redemptions.coupon_id` (CASCADE -> SET NULL, keep `coupon_code` snapshot), `payout_requests.vendor_id`: detach rather than delete.
  - `prepare_seller_deletion`: keep `open_orders` check unchanged; remove the two `retention_review_required` blocks for finished history.
  - `finish_seller_deletion`: before deleting products/profile, null out `customer_id`/`vendor_id`/`product_id` on retained rows for the deleted scope, and clear PII on the deleted buyer's orders (`phone`, `shipping_address`, name fields) and payout `details`; never delete orders/payments/transactions/status history.
  - Audit `validate_seller_deletion` preflight and the `guard_deletion_writes` trigger so detach updates are allowed only within the service cleanup session.
  - Check every RPC/UI that joins `orders.customer_id`, `order_items.product_id`/`vendor_id` (vendor orders, admin order detail, OrderProductImage, reviews/reorder) handles NULL and shows «حساب محذوف» / snapshot data.
- Update `src/lib/sellerDeletion.ts` messages and deletion dialog copy; keep `retention_review_required` only as a fallback code.
- Extend `src/test/seller-deletion.test.ts` (PGlite) with the cases above; run seller-deletion, admin and order tests.
- Update `roadmap.md` (close the blocked retention item) and the `seller-deletion` memory with the chosen retention rule.
