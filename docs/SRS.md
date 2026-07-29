# Silo Shop — Enterprise Software Requirements Specification (SRS)

Version: 1.0
Status: Baseline derived from the current implemented codebase, Supabase schema, RLS policies, RPCs, admin phases 1–6, and prior product decisions in this project.
Language: Arabic RTL first; English as future locale.
Source of truth: Lovable Cloud (Supabase) database, RPCs, and Storage. No mock data, no fake APIs.

> This SRS expands the master template into concrete, enterprise-grade requirements using the *existing* Silo Shop business model: an Arabic-first Syrian marketplace with Cash on Delivery for seller products, admin-curated platform products, dual-role auth (customer/vendor), and full moderation.

---

## 1. Vision & Goals

### 1.1 Vision
Silo Shop is the leading Arabic-first e-commerce marketplace for Syria, combining trusted platform-curated products with a moderated multi-vendor marketplace, all payable via Cash on Delivery (COD) in Syrian Lira (ل.س).

### 1.2 Business Goals
- Enable Syrian buyers to shop safely with COD across all 14 governorates.
- Enable approved vendors to list, manage, and fulfill orders with clear PII controls.
- Give admins/moderators full oversight over users, products, orders, chats, reports, and analytics.
- Maintain enterprise-grade security posture (RLS on every public table, SECURITY DEFINER RPCs for privileged writes, no client-side role enforcement).

### 1.3 Non-Goals (current phase)
- No online payments, wallets, cards, or Sham Cash integration in production; COD only.
- No multi-currency; SYP only.
- No mobile-native app; PWA only.
- No affiliate/loyalty programs.

### 1.4 Success Metrics (KPIs)
- Order completion rate (delivered / created).
- Vendor approval funnel (pending → approved).
- Report resolution SLA (median hours from `pending` → `resolved|rejected`).
- Return-request throughput (approved / requested within 14 days).
- Homepage LCP < 2.5s on mid-range mobile.
- Zero `error`/`critical` findings on the security scanner gate.

---

## 2. System Architecture

### 2.1 Layered View
```
PWA (React 18 + Vite 5 + TS 5 + Tailwind + shadcn)
        │  supabase-js
        ▼
Supabase Auth  ──►  Postgres (RLS + SECURITY DEFINER RPCs + triggers)
        │                     │
        │                     ├── pgmq email queue
        │                     └── Realtime publication (scoped)
        ▼
Edge Functions (Deno): auth-email-hook, process-email-queue,
  send-push-notification, get-mapbox-token, get-vapid-key,
  notify-* (order/vendor/admin)
        │
        ▼
Supabase Storage buckets: product-images (public read),
  review-images (public URL only, no list), seller-documents (private)
```

### 2.2 Principles
- Database is the security perimeter. Every public table has RLS + explicit GRANTs.
- All privileged writes flow through SECURITY DEFINER RPCs that validate `auth.uid()` and roles via `has_role` / `has_any_role`.
- Realtime subscriptions inherit RLS — SELECT policies double as broadcast filters.
- Client never trusts roles; `RequireRole` and `useAdminCheck` are UX guards only.
- No secret keys in the browser bundle. Only publishable/anon key.

### 2.3 Environments
- Dev preview (Lovable), Production (published domain `siloshop.net`).
- CI: `.github/workflows/security.yml` runs anon RLS regression + scanner gate; `security-postdeploy.yml` diffs new findings.

---

## 3. User Roles & Permissions (RBAC)

### 3.1 Enums
- `app_role`: `customer`, `vendor`, `admin`, `super_admin`, `moderator`.
- `user_role` (profiles): `customer`, `vendor` — the *self-declared* role at signup.

### 3.2 Storage
Roles live in `public.user_roles(user_id, role)` — never on `profiles`. `has_role(uid, role)` and `has_any_role(uid, role[])` are `SECURITY DEFINER STABLE` and used in every RLS policy that needs a role check.

### 3.3 Capability Matrix
| Capability | customer | vendor | moderator | admin | super_admin |
|---|---|---|---|---|---|
| Browse approved products | ✓ | ✓ | ✓ | ✓ | ✓ |
| Place COD order | ✓ | ✓ | ✓ | ✓ | ✓ |
| List seller products | | ✓ (if approved) | | | |
| Manage platform products | | | | ✓ | ✓ |
| Approve/reject sellers | | | | ✓ | ✓ |
| Moderate products/reviews | | | ✓ | ✓ | ✓ |
| Delete messages / block chats | | | ✓ | ✓ | ✓ |
| Manage reports | | | ✓ | ✓ | ✓ |
| Ban / delete user | | | | | ✓ |
| Suspend user | | | | ✓ | ✓ |
| View analytics | | | | ✓ | ✓ |
| Rotate secrets / manage roles | | | | | ✓ |

### 3.4 Acceptance
- No client-only role gate blocks or unblocks any privileged action; each is also enforced by an RLS policy or RPC role check.
- Escalation attempts (a customer calling an admin RPC) are rejected server-side with a permission error.

---

## 4. Authentication & Account Lifecycle

### 4.1 Sign-up
- Email + password, role choice (customer/vendor), full name.
- Password subject to Supabase HIBP (leaked-password) check.
- 6-digit OTP email verification via `auth-email-hook` + templates in `supabase/functions/_shared/email-templates/`.
- Google OAuth enabled with `redirect_uri = ${window.location.origin}/auth/callback`.

### 4.2 Sign-in Protection
- Unverified users cannot access authenticated routes; `RequireRole` redirects to `/verify-email`.
- Banned/suspended accounts (`profiles.account_status ∈ {suspended, banned}`) are blocked from privileged actions and see status reason.

### 4.3 Account Status
`profiles.account_status`: `active | suspended | banned`. RPCs: `admin_suspend_user`, `admin_activate_user`, `admin_ban_user`. Only `super_admin` can ban/delete.

### 4.4 Profile Updates
- Non-sensitive fields (name, phone, avatar) via `update_own_profile` RPC.
- `role`, `account_status`, `is_banned` never client-writable.

### 4.5 Acceptance
- New sign-up with weak/leaked password is rejected.
- Unverified email cannot place an order or list a product.
- Banned user sees the ban reason and cannot log in to protected areas.

---

## 5. Buyer Experience

### 5.1 Discovery
- Homepage: HeroSection, PopularCategories (12 dynamic), FeaturedProducts, EnhancedDailyDeals, BestSellers, PurchasedRecently, ProductRecommendations, native ads.
- Category / Subcategory pages with sort (newest, price asc/desc, rating, best-selling) and filters (brand, price, availability, rating, free shipping).
- Search (`/search`) with Arabic diacritic-insensitive normalization; filters persist in localStorage.
- MegaMenu drives category navigation.

### 5.2 Product Page
- Interactive image gallery (vertical thumbs, zoom), sticky action bar, quantity discounts, VendorRating, ProductReviews with replies, SimilarProducts, ReviewsChart.
- "Report" button on product, seller, and message.

### 5.3 Cart & Checkout
- Multi-vendor cart grouping.
- Shipping shown per item (or "شحن مجاني").
- Coupons via `validate_coupon` + `redeem_coupon` (tamper-proofed by trigger).
- Governorate picked from `src/lib/syrianGovernorates.ts` (14 fixed values).
- COD only. `create_order` computes totals + shipping server-side.

### 5.4 Post-Order
- Cart cleared; favorites of purchased items auto-removed.
- `/orders` timeline with 7 stages: pending → confirmed → preparing → shipped → out_for_delivery → delivered → cancelled.
- Realtime last-updated badge on `/orders/track/:id`.
- 14-day return window via `create_return_request`.
- Delivery rating after `delivered`.

### 5.5 Acceptance
- Placing an order with invalid coupon fails atomically; no order row is created.
- Cancellation is possible only pre-`shipped`.
- Return request outside 14 days is rejected server-side.

---

## 6. Vendor Experience

### 6.1 Onboarding
- `seller_applications` with docs (identity, business) into `seller-documents` bucket.
- Admin reviews via `admin_list_seller_applications` and calls `approve_seller_application` / `reject_seller_application`.
- Suspended vendor cannot list new products but keeps existing history.

### 6.2 Catalog Management
- Products default to `moderation_status = 'pending'` (seller products) or auto-`approved` (platform products by admin).
- Public SELECT policy requires `moderation_status = 'approved' AND is_active = true`.
- Vendor may add: name, description, price, discount_price, stock, images (compressed client-side), sizes/colors, weight, per-item shipping cost, brand, category/subcategory.

### 6.3 Orders & Fulfillment
- `get_vendor_orders` returns only rows the vendor is entitled to (order_items scoped).
- `VendorOrders` hides customer phone and full address by default (PII minimization).
- Status transitions via `vendor_update_order_status`.

### 6.4 Returns
- `VendorReturns` page. Vendor approves/rejects; state transitions logged in `return_status_history`.

### 6.5 Sales Stats
- `get_vendor_sales_stats`: only delivered COD revenue counted.

### 6.6 Acceptance
- Rejected vendor cannot list a product.
- Vendor querying another vendor's orders returns zero rows.

---

## 7. Admin & Moderator Experience

### 7.1 Dashboards
- `/dashboard/analytics` (KPI cards + charts via `admin_get_analytics`).
- `/dashboard/orders` (search/filter/export CSV, cancel/refund/update status).
- `/dashboard/reports` (pending/under_review/resolved/rejected).
- `/dashboard/chat-moderation` (list conversations, view messages, delete/block/suspend).
- `/dashboard/seller-management` (approve/reject/suspend/reactivate/delete seller).
- `/dashboard/platform-products` (SKU-based, bulk CSV/XLSX import, multi-image).
- `/dashboard/users` (suspend/ban/activate).
- `/dashboard/native-ads`, `/dashboard/announcements`, `/dashboard/deals`, `/dashboard/coupons`, `/dashboard/subcategories`, `/dashboard/activity-logs`.

### 7.2 Moderation Logs
- `product_moderation_log`, `chat_moderation_log`, `return_status_history`, `order_status_history`, `activity_logs` — append-only for auditing.

### 7.3 Acceptance
- Moderator cannot ban a user; only suspend/hide content.
- Every state change writes a log row identifying `performed_by` + role.

---

## 8. Product Moderation

### 8.1 Model
`products.moderation_status ∈ { pending | approved | rejected | hidden }`.

### 8.2 Flow
```
vendor creates → pending → admin_moderate_product(approve|reject|hide|restore)
                                          │
                                          └─ writes product_moderation_log
```

### 8.3 RLS
- Public SELECT: `moderation_status = 'approved' AND is_active = true`.
- Owner (vendor) sees own rows regardless of status.
- Admin/moderator sees all.

### 8.4 Acceptance
- A newly-created seller product is not visible on the homepage until approved.
- Hidden product remains reachable via direct URL only for admins/moderators.

---

## 9. Reports System

### 9.1 Table
`reports(reporter_id, report_type ∈ {product, seller, buyer, message, review}, target_id, reason, description, status ∈ {pending, under_review, resolved, rejected}, resolution_note, resolved_by, resolved_at, created_at, updated_at)`.

### 9.2 Flow
`submit_report` (any authenticated user) → admin/moderator triage via `admin_list_reports` → `admin_update_report(status, resolution_note)`.

### 9.3 UI
"Report" button on Product, Vendor page, message bubble, and buyer profile (from an order).

### 9.4 Acceptance
- Reporter cannot see other users' reports.
- Admin resolving a report can attach a resolution note that is stored and audit-logged.

---

## 10. Chat & Messaging

### 10.1 Model
- `conversations(customer_id, vendor_id, product_id?, is_blocked, is_suspended, suspended_until, moderation_reason, moderated_by, moderated_at)`.
- `messages(conversation_id, sender_id, message_type ∈ {text, image, file}, content, file_url, is_read, is_deleted, deleted_by, deleted_at)`.

### 10.2 Rules
- Conversation created via `get_or_create_conversation` (race-safe).
- Moderation fields are trigger-protected: only admin/moderator can modify `is_blocked`, `is_suspended`, `suspended_until`, `moderation_reason`, `moderated_by`, `moderated_at`, and participant IDs.
- Deleted messages render as "تم حذف الرسالة" for regular users.
- Realtime is SELECT-scoped to conversation participants.

### 10.3 Acceptance
- Non-admin UPDATE against a moderation field is rejected by the trigger.
- Suspended conversation blocks new messages until `suspended_until` passes.

---

## 11. Orders, Cancellation & Returns

### 11.1 Order Lifecycle
`pending → confirmed → preparing → shipped → out_for_delivery → delivered` with `cancelled` as a terminal branch pre-`shipped`.

### 11.2 RPCs
- `create_order` (server-computed totals/shipping, atomic).
- `cancel_order` (customer or admin; only pre-`shipped`).
- `vendor_update_order_status` (allowed transitions only).
- `admin_cancel_order`, `admin_refund_order`, `admin_update_order_status`.
- `record_payment` (COD; locks `orders` FOR UPDATE, prevents double-pay).

### 11.3 Returns
- 14-day window post-`delivered`.
- `create_return_request` (customer) → `update_return_status` (vendor/admin) with `return_status_history` append-only trail.
- Images/video uploaded to Storage with MIME + 5MB client-side validation.

### 11.4 Acceptance
- Cancellation after `shipped` is rejected.
- `used_count` on coupons cannot be mutated outside `redeem_coupon` (trigger + column REVOKE).

---

## 12. Payments

### 12.1 Method
Cash on Delivery only. `payments.payment_method = 'cash'` enforced by `record_payment`. Payment is recorded only when the courier confirms delivery.

### 12.2 Immutability
- `payments` no client INSERT/UPDATE. Only `record_payment`.
- `orders.total_amount`, `orders.discount_amount` set by `create_order`; never client-writable.

### 12.3 Acceptance
- Any client attempt to insert into `payments` returns permission denied.
- Double-pay attempts are rejected inside `record_payment`.

---

## 13. Notifications

### 13.1 Channels
- In-app (`notifications` table, 7-day auto-delete).
- Web Push (`push_subscriptions`, VAPID) via `send-push-notification` edge function.
- Email (auth + transactional) via `pgmq` queue + `process-email-queue`.

### 13.2 Triggers
Order status change, price drop, low stock, new order (vendor), new rating (vendor), review reply, brand-follow new product, favorites-deal start/end, admin new-user.

### 13.3 Preferences
`notification_preferences` per user for each channel/category. Optimistic saves; RLS scoped to owner.

### 13.4 Acceptance
- Disabling "price_drops" stops both in-app and push for that category.
- Notifications never inserted directly from client; all via SECURITY DEFINER triggers/RPCs.

---

## 14. Storage & Media

### 14.1 Buckets
- `product-images` — public read, vendor writes scoped to `auth.uid()` folder.
- `review-images` — public URL only, no `list` permission.
- `seller-documents` — private, admin read only.

### 14.2 Client-Side Validation
- MIME whitelist (`image/jpeg|png|webp|gif`), 5 MB max, client-side compression before upload.

### 14.3 Acceptance
- Anonymous list of `review-images` returns nothing.
- Vendor cannot upload into another vendor's folder.

---

## 15. Search, Filtering & Recommendations

### 15.1 Search
- Arabic diacritic + variant normalization (`src/lib/search.ts`).
- Filters: category, subcategory, brand, price range, rating, availability, free shipping, discount.
- Sort: newest, price asc/desc, rating, best-selling.
- Persistence: localStorage per session.

### 15.2 Recommendations
- Homepage recommendations from recently-viewed, favorites, category affinity.
- `RecentlyViewed` capped at 50 items in DB with realtime updates.

### 15.3 Acceptance
- Query "قميص" matches "قَميص" and "قميصْ".
- Sort by rating orders by aggregated review score, not raw count.

---

## 16. Analytics

### 16.1 Admin
- `admin_get_analytics` returns users, sellers, buyers, orders, revenue, products, reports, active users.
- `/dashboard/analytics` renders KPI cards + charts.

### 16.2 Ad Analytics
- `ad_analytics(ad_slot, event_type ∈ {impression, click}, page_url, session_id)`; anonymous INSERT allowed; only admins SELECT.
- 50% visibility threshold for impression tracking.

### 16.3 Vendor
- `get_vendor_sales_stats` — delivered COD revenue only.

### 16.4 Acceptance
- Non-admin cannot read `ad_analytics`.
- Analytics figures reconcile with underlying tables (spot check within ±0 rows).

---

## 17. UI/UX & Design System

### 17.1 Direction
RTL by default; LTR overrides for numeric inputs where needed.

### 17.2 Tokens
- Primary Purple `hsl(263 70% 50%)`, Accent Pink/Red `hsl(340 82% 52%)`.
- Motion: `cubic-bezier(0.22, 1, 0.36, 1)`; global `prefers-reduced-motion` overrides.
- Focus rings WCAG AA compliant.
- No hardcoded color utilities in components; only semantic tokens from `src/index.css`.

### 17.3 Components
- shadcn/ui base; `Navbar`, `MobileBottomNav`, `PullToRefresh`, `FlyToCart`, `SectionErrorBoundary`, `NotificationsDropdown`.
- Mobile-first, 2-column product grid on mobile, backdrop blur on quick actions.

### 17.4 Accessibility
- All interactive elements keyboard-reachable and labeled.
- Live regions for cart updates and toast announcements.

### 17.5 Acceptance
- Lighthouse a11y score ≥ 95 on Home, Product, Cart, Checkout.
- No layout shift > 0.1 CLS on homepage.

---

## 18. Validation Rules

### 18.1 Client
- Email format, password length ≥ 8, phone Syrian format, positive prices/stocks, non-empty product title, image MIME + size.
- Governorate must be one of the 14 fixed values.

### 18.2 Server
- All monetary computations server-side.
- Coupon expiry, max_uses, min_purchase enforced in `validate_coupon` / `redeem_coupon`.
- Return window enforced in `create_return_request`.
- Order status transitions enforced in `vendor_update_order_status` / `admin_update_order_status`.

### 18.3 Acceptance
- Bypassing client validation still results in DB rejection with a clear error.

---

## 19. Security & Compliance

### 19.1 Enforcement
- RLS on every public table; explicit GRANTs; no default-privilege reliance.
- SECURITY DEFINER RPCs with `SET search_path = public` (extended for pgmq wrappers).
- Column-level REVOKE on sensitive fields (`orders.delivery_lat/lng`, `order_status_history.location_*`, `coupons.used_count`).
- Realtime publications scoped so RLS is the broadcast filter.
- Admin/moderator UPDATE trigger on `conversations` moderation fields.

### 19.2 Rate Limiting
- `contact_rate_limits`: 3 submissions per email per hour, hashed IP + email.
- Push subscription unique per endpoint.

### 19.3 Audit
- `activity_logs` append-only via `log_activity` RPC.
- Moderation logs per subsystem (products, chat, returns, orders).

### 19.4 CI Gate
- Anon RLS regression suite (`src/test/security-rls.test.ts`).
- Scanner gate blocks deploy on `error`/`critical`.
- Post-deploy diff annotates new findings.

### 19.5 Acceptance
- Fresh scan shows zero unresolved `error`/`critical` findings.
- All new tables in migrations include GRANT + ENABLE RLS + at least one policy in the same migration.

---

## 20. Performance & Scalability

### 20.1 Frontend
- Route-level `React.lazy` splitting; bundle target < 900 KB gz.
- Homepage sections wrapped in `SectionErrorBoundary`; visibility-first rendering; no lazy on above-the-fold.
- Image compression before upload; responsive `sizes`; lazy load below fold.

### 20.2 Backend
- Covering indexes: `products(moderation_status, is_active, created_at)`, `reports(status, created_at)`, `messages(conversation_id, created_at)`, `order_items(vendor_id, order_id)`.
- Server-side pagination on every admin list endpoint.
- Realtime channels scoped by RLS, not broadcast-all.

### 20.3 Future Scalability
- Add English locale (i18n scaffolding retains keys, not literals).
- Add second currency by introducing per-currency price columns (already present as `products.currency`).
- Optional edge caching for public catalog reads.
- Optional payment provider abstraction — keep `payments.payment_method` open to future values.

---

## 21. Edge Functions & Integrations

### 21.1 Functions
- `auth-email-hook` (verify_jwt=false) — sends OTP via custom templates.
- `process-email-queue` (verify_jwt=true) — pulls pgmq, sends transactional email.
- `send-push-notification` — VAPID web push.
- `get-mapbox-token`, `get-vapid-key` — JWT-validated token brokers.
- `notify-admin-new-user`, `notify-customer-order-status`, `notify-vendor-new-order`.

### 21.2 Rules
- All non-hook functions require JWT.
- Never log secrets. Never expose service-role key to the client.
- Custom domain: `notify.siloshop.net` for OTP + transactional email.

---

## 22. Testing Strategy

### 22.1 Layers
- Unit: `src/lib/__tests__/*`, `src/components/__tests__/*` (Vitest + JSDOM).
- Integration: homepage smoke test (`homepage-smoke.test.tsx`), favorites/order sync.
- Security: anon RLS regression suite (`security-rls.test.ts`).
- Manual: dashboard flows per role, checkout on mobile viewport.

### 22.2 CI
- `bunx vitest run` on every PR.
- Security workflow runs RLS suite + `scripts/security-gate.mjs`.
- Post-deploy diff via `scripts/security-diff.mjs`.

### 22.3 Acceptance
- Green CI required before publish.
- New RLS change requires a new/updated test case in the regression suite.

---

## 23. Deployment, Versioning & Checklist

### 23.1 Deployment
- Frontend: Lovable publish → `siloshop.net` / `www.siloshop.net`.
- Backend: migrations applied via Lovable Cloud on approval; edge functions redeployed on save.
- Rollback: revert migration by shipping a compensating migration; never mutate history.

### 23.2 Versioning
- Semantic tagging on frontend releases.
- DB migrations timestamped; description written for non-technical review.

### 23.3 Release Checklist
- [ ] All new `public` tables have GRANT + RLS + policies.
- [ ] All new RPCs are SECURITY DEFINER with `SET search_path = public`.
- [ ] All new client mutations go through an RPC or an RLS-protected policy.
- [ ] Realtime scope reviewed for any new table added to the publication.
- [ ] Security scanner: zero `error`/`critical`.
- [ ] Vitest suite green.
- [ ] Docs updated: this SRS, `docs/rls-policies.md`, `README.md` (if user-facing behavior changed).
- [ ] Arabic RTL verified on Home, Product, Cart, Checkout, Orders, Vendor Dashboard, Admin Dashboard.

### 23.4 Documentation Duty
Every phase must update this SRS section-by-section and the release checklist. No feature is "done" until its acceptance criteria here can be checked off.

---

## Master Rules (binding)

1. Supabase is the single source of truth.
2. No mock data or fake APIs.
3. Enterprise-grade security and scalability.
4. Arabic RTL first with future English support.
5. Every feature must be tested before completion.
6. Every phase must update documentation and checklist.
