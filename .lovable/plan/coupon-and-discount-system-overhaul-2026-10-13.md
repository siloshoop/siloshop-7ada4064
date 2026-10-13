# Coupon and discount system overhaul

## What exists today
- Coupons: one seller each, optional chosen products, one total use limit (`max_uses`/`used_count`), an expiry date, a fixed or percentage discount, a minimum purchase amount.
- Product sales ("today's deals"): percentage only, with start and end dates. No sale price, no sale quantity.
- Orders save the coupon code, discount, subtotal, shipping and currency. Invoices already read these saved values.
- Cash on delivery only.

## What will change

**1. Coupon stays applied until confirmation**
- The code is stored for the cart session and re-checked by the server on cart, checkout and order confirmation. It is never silently dropped. If it becomes invalid, the shopper sees the reason.
- The order saves the final total from the server's calculation. Order screens, notifications and invoices show only those saved values.

**2–3. Unit limits on coupons**
New optional seller settings (empty means unlimited):
- maximum discounted units across all customers
- maximum discounted units per order
- maximum uses per customer

Only the allowed number of units gets the discount. For example, with a limit of 1, buying 3 units discounts 1 unit.

**4. Automatic expiry**
- A coupon stops working when its end time passes or its units or uses run out. A scheduled job marks it inactive.
- A product sale ends at its end time or when its sale quantity runs out.

**5. Sale prices**
- Sellers can set either a sale price or the existing percentage, plus start and end dates and an optional sale quantity.
- The original price is shown crossed out next to the sale price.
- Existing percentage deals keep working.

**6. Combining rules (per coupon)**
- "Can be combined with sale prices": on or off. Default is off, so a coupon doesn't apply to units already on sale.
- Only one coupon per order per seller. Using two coupons on the same unit is blocked.

**7. Currency**
- Correct currency codes and consistent two-decimal rounding.
- The project rule says prices are never converted between currencies. A coupon applies only to products in the coupon's currency. No exchange rates will be added (see question below).

**8. Saved history**
- Each order line saves its original price, sale discount, coupon discount and coupon code. Promotions ending later don't change past orders, invoices or notifications.

**9. Seller coupons page**
- Shows status (active, scheduled, expired, used up, stopped).
- Shows discounted units: used, reserved, remaining and total.
- Shows redemption counts and expiry dates.

**10. Server enforcement**
- All prices and limits are calculated inside order creation, in one database transaction, with row locks on the coupon and sale. This prevents overselling and double redemptions when shoppers check out at the same time.
- New redemption records track each order's coupon and sale units as reserved, then used.
- Cancelling an order, or a seller rejecting it, releases its reservations. Delivery makes them final.

**11. Testing**
- Automated tests for the discount maths:
  - unit limits, including the 1-unit case
  - per-order and per-customer limits
  - combining rules
  - expiry
  - sale price versus percentage
  - per-currency rounding
- Database checks on the server functions, run with test rows in a transaction that is rolled back, so no real data changes:
  - quote, create order, cancel, release
  - limits under simulated simultaneous checkouts
- Existing invoice, currency and cash-on-delivery tests are run again.
- Limitation: placing a real order in the browser needs a signed-in buyer account, which isn't available. That step will be reported as not verified.

## Technical details
- Migration, additive only:
  - coupons: `max_discounted_units`, `max_units_per_order`, `max_uses_per_customer`, `starts_at`, `combinable_with_sale`
  - daily_deals: `sale_price`, `sale_quantity`, `sold_quantity`
  - new `coupon_redemptions` table (order_id, coupon_id, customer_id, units, status reserved/used/released) with RLS: seller reads own, buyer reads own, admin all
  - order_items: `original_price`, `sale_discount`, `coupon_discount`, `coupon_code`
- Update `quote_cart_coupon` and `create_order` (with `FOR UPDATE` locks), `cancel_order`, plus a status trigger that releases or finalizes redemptions.
- A pg_cron job every 5 minutes deactivates expired or used-up coupons and deals. Reads also check the time directly, so nothing depends only on the job.
- Shared discount maths in `src/lib/discountRules.ts`, mirrored by the server, with tests next to it.
- Frontend: ManageCoupons and ManageDeals forms and status table, Cart and Checkout coupon persistence, ProductCard and Product sale-price display, CustomerInvoice and PrintOrderDocs line discounts.
