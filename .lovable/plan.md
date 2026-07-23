# Marketplace Administration System — Phased Plan

This request is very large. Much of it already exists in the project (RBAC, seller approval, platform vs seller products, RLS, cancel/update orders, notifications, admin search of users/sellers, dashboard stats). I'll extend what exists rather than rebuild, and split the new work into reviewable phases. Please approve the plan (and pick a starting phase) before I implement.

## Already in place — will reuse, not rebuild
- Roles: `app_role` enum (`admin`, `vendor`, `customer`) with `user_roles` table + `has_role()` security-definer function.
- Seller approval lifecycle: `seller_applications` + `approve/reject/suspend/reactivate/delete_seller_*` RPCs + notifications.
- Platform vs seller products: `products.product_type` + admin-only platform RLS + `PlatformProducts` admin UI + bulk import.
- Order lifecycle: `create_order`, `cancel_order`, `vendor_update_order_status`, status history, notifications.
- Admin pages: users, sellers, native ads, activity logs, platform products.
- RLS + GRANTs across 40+ tables; realtime scoping; rate-limits; return system.
- COD payments via `record_payment` (cash-only currently).

## New / changed work — phases

### Phase 1 — Roles & moderation foundation (DB migration)
- Extend `app_role` enum with `super_admin` and `moderator`.
- Add `has_any_role(_user_id, _roles app_role[])` helper.
- Add `profiles.account_status` enum: `active | suspended | banned` (default `active`); RPCs `admin_suspend_user`, `admin_activate_user`, `admin_ban_user`, `admin_delete_user` (super_admin only for delete/ban).
- Add `products.moderation_status` enum: `pending | approved | rejected | hidden` (seller products default `pending`; platform products auto-`approved`).
- Update public product SELECT policies to require `moderation_status = 'approved' AND is_active = true`.
- RPCs: `admin_moderate_product(id, action, reason)` covering approve/reject/hide/restore/suspend/delete; writes to a new `product_moderation_log`.

### Phase 2 — Reports system (DB + admin UI)
- New table `reports(id, reporter_id, target_type: product|seller|buyer|message, target_id, reason, details, status: open|reviewing|resolved|dismissed, resolution_note, resolved_by, resolved_at, created_at)` with GRANTs + RLS (reporter can insert/see own; admin/moderator can see all + update).
- Client "Report" buttons on Product page, vendor page, message bubble, and buyer profile from an order.
- Admin page `/dashboard/reports` with filters, detail drawer, and actions (delete content, suspend user, close report) wired to existing RPCs.

### Phase 3 — Chat moderation
- Add `messages.is_deleted`, `conversations.is_blocked`, `conversations.is_suspended`.
- RPCs: `moderator_delete_message`, `moderator_block_conversation`, `moderator_suspend_conversation` (admin + moderator only).
- Admin page `/dashboard/chat-moderation` listing conversations with search, message viewer, and action buttons. Regular users see deleted messages as "تم حذف الرسالة".

### Phase 4 — Sham Cash for platform products (payments split)
- Extend `payments.payment_method` to include `sham_cash`.
- `create_order` reworked: when cart contains only platform products → allowed payment methods = `sham_cash`; when cart contains only seller products → `cash` only; mixed carts split into two orders server-side.
- `record_payment` accepts `sham_cash` only for platform orders; stores platform owner's Sham Cash account reference from a new `platform_payment_settings` singleton table (super_admin managed). No seller access.
- Checkout UI branches on cart composition and shows the correct method(s).

### Phase 5 — Admin dashboard stats + global search
- Extend existing admin dashboard with tiles: users, sellers, buyers, products, platform products, seller products, orders, revenue, pending sellers, pending products, suspended accounts, open reports — via one aggregate RPC `admin_dashboard_stats()`.
- Global search page `/dashboard/search` (admin) hitting users/sellers/buyers/products/orders/reports through paginated RPCs.
- Login/activity history view built on the existing `activity_logs` table with filters.

### Phase 6 — Performance & polish
- Add covering indexes for new filters (`products(moderation_status, is_active, created_at)`, `reports(status, created_at)`, `messages(conversation_id, created_at)`).
- Server-side pagination on every admin list.
- Verify all new tables have GRANTs + RLS + service_role grants.
- Fix any linter findings surfaced by the migrations.

## Explicitly out of scope for this plan
- Building multi-currency, multi-language, wallet, loyalty, affiliate, or a mobile app now. The schema additions above are compatible with adding them later, but I won't implement them in this pass.

## Technical notes
- All privileged writes go through `SECURITY DEFINER` RPCs that check `has_any_role(auth.uid(), ARRAY['admin','super_admin','moderator'])` — never client-side role checks for enforcement.
- Every new `public` table ships with `GRANT` + `ENABLE RLS` + policies in the same migration.
- Notifications reuse the existing `notifications` table + trigger pattern.
- Client role gating uses the existing `RequireRole` component, extended to accept `super_admin` / `moderator`.

## How to proceed
Please confirm, and tell me which phase to start with (I recommend Phase 1 first — everything else depends on the new roles and product moderation status). I'll implement one phase per turn so you can review each migration before the next.
