# SiloShop — Phases 8–14 (Implementation & Verification)

## Phase 8 — Order & Return Management
- `create_order` now validates and **decrements stock** with row-level locks (`FOR UPDATE`), preventing overselling. Raises `OUT_OF_STOCK:<name>`.
- `cancel_order` / `admin_cancel_order` restore stock (reason `return`) and update payment status.
- `update_return_status` fixed (invalid `notifications.data` column removed), Arabic status labels in buyer notifications, and stock is restored automatically once a return reaches `returned`.
- Seller surfaces: `/dashboard/orders`, `/dashboard/returns`; admin: `/admin/orders`.

## Phase 9 — Messaging
Buyer↔seller chat via `conversations` / `messages` with `get_or_create_conversation`, typing indicators, read receipts, 5MB file validation, and admin moderation (`/admin/chats`: view, suspend, block, delete).

## Phase 10 — Notifications
In-app (`notifications`), push (`push_subscriptions`), and email. DB triggers cover order status, new order, low stock, new rating, chat message, price drops. Preferences per user in `notification_preferences`.

## Phase 11 — Customer Privacy
Sellers never receive raw buyer PII: `get_vendor_orders` returns name + city only; phone is masked (`****1234`) in `VendorOrders`; `SellerCustomers` aggregates without contact data. Full address/coordinates are not exposed to sellers.

## Phase 12 — Fake / Spam Order Protection
Enforced server-side inside `create_order`:
- max **5 orders per hour** per account → `ORDER_RATE_LIMIT`
- max **10 open orders** (`pending`/`confirmed`/`processing`) → `TOO_MANY_OPEN_ORDERS`
- product availability + approval + active checks before an order row is created.
Arabic toasts for each case in `src/pages/Checkout.tsx`.

## Phase 13 — Payment Model
Cash on Delivery only for seller products (`payment_method = 'cod'`). Platform (imported) products with Sham Cash remain gated behind `feature_flags` and are disabled. Mixed carts are rejected (`MIXED_CART`).

## Phase 14 — Verification
- TypeScript: clean (`tsgo --noEmit`).
- Tests: 35 passing across 6 files (`vitest run`).
- Realtime enabled for `stock_movements`, `orders`, `notifications`, `messages` with RLS scoped per user/vendor.
