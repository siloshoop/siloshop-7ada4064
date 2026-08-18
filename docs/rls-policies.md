# Row-Level Security Policies

This document explains the RLS policies enforced on our Supabase (Lovable Cloud) backend,
why each exists, and how it is tested. Update it whenever a policy changes.

> Ground rule: policies are enforced at the database. SECURITY DEFINER RPCs are the only
> way to bypass them, and every such RPC validates `auth.uid()` explicitly.

## Tables & policies

### `orders`
| Policy | Command | Rule | Why |
| --- | --- | --- | --- |
| Customers can view their own orders | SELECT | `auth.uid() = customer_id` | Customers must see their own history. |
| Vendors can view orders containing their items | SELECT | `EXISTS order_items WHERE oi.order_id = orders.id AND oi.vendor_id = auth.uid()` | Vendors need order rows to fulfil items — scoped so realtime cannot broadcast other customers' PII/GPS. |
| Orders cannot be deleted | DELETE | `false` | Orders are financial records. |

Writes go through `create_order()` (SECURITY DEFINER) which computes totals and shipping
server-side to prevent price tampering. Status updates go through `vendor_update_order_status()`.

### `order_items`
Direct `INSERT` is blocked. Rows are created by `create_order()`. `SELECT` follows the
same customer/vendor split as `orders`.

### `order_status_history`
| Policy | Command | Rule | Why |
| --- | --- | --- | --- |
| Users can view their order history | SELECT | Customer owns the order | Timeline visibility. |
| Vendors can view status history for their orders | SELECT | Vendor has an item in the order | Needed so vendor UI + realtime broadcasts are scoped, not global. |
| Vendors can add status updates for their orders | INSERT | Vendor has an item in the order | Vendor-driven status transitions. |

GPS columns (`location_lat`, `location_lng`) are excluded from the `authenticated` role via
column-level `REVOKE` and removed from the realtime publication.

### `orders` realtime scope
Because `orders` is in `supabase_realtime`, RLS on `SELECT` doubles as the broadcast filter.
The vendor SELECT policy above is therefore load-bearing — without it, realtime would
leak other customers' rows to any authenticated subscriber.

### `coupons`
`used_count` may only be changed by `redeem_coupon()`. Enforced by:
1. `REVOKE UPDATE (used_count) ON coupons FROM authenticated`
2. `prevent_coupon_used_count_tamper` BEFORE UPDATE trigger requiring
   `current_setting('app.coupon_redeem') = 'on'`, which `redeem_coupon()` sets inside
   its own transaction only.

### `payments`
No client INSERT/UPDATE policy. `record_payment()` (SECURITY DEFINER) locks the order
`FOR UPDATE`, derives the amount from `orders.total_amount`, and blocks double-pay —
and since the payment audit its `EXECUTE` is granted to `service_role` only.
Previously `authenticated` could call it and mark its own pending COD order
`completed` / `confirmed` with an arbitrary `payment_method`.

`payment_status` and `payment_method` are constrained by CHECK
(`pending|paid|completed|failed|cancelled|refunded`, `cod|cash|sham_cash|syriatel|mtn|card|bank_transfer`).

### `settle_sham_cash_payment()`
The only path that may mark an order paid. `service_role`-only (EXECUTE revoked from
`anon`/`authenticated`, plus an in-function `auth.role()` check). It locks the order,
requires `order_kind = 'platform'` and `payment_method = 'sham_cash'`, verifies the
callback amount against `orders.total_amount` and the currency against `SYP`, is
idempotent per order, refuses to un-pay a paid/refunded order, and writes exactly one
`order_status_history` row and one customer notification per settlement.
`sham-cash-webhook` verifies the HMAC signature first (fail-closed: a missing
`SHAM_CASH_WEBHOOK_SECRET` or missing header yields `401`) and then delegates all
state changes to this RPC.

### `notifications`
No direct client `INSERT` policy. All notifications are produced by SECURITY DEFINER
trigger functions (order status change, price drop, brand follow, …) or by the
`send_notification()` RPC, which requires admin role when the target user differs from
the caller.

### `delivery_ratings`
- Users can view/update/insert their own ratings for delivered orders.
- Admins can view all ratings for moderation via `has_role(auth.uid(),'admin')`.

### `ad_analytics`
- Anonymous `INSERT` is intentional (impression/click pixel).
- CHECK constraints restrict `event_type` to `impression|click`, and cap
  `ad_slot`/`page_url`/`session_id` shape and length to prevent enumeration/pollution.
- Only admins can `SELECT`.

### Storage buckets
- `product-images` (public read): vendors can only upload/update/delete under a
  folder matching their `auth.uid()`.
- `review-images` (public bucket, no `SELECT` policy): files are only readable via
  the public URL a reviewer explicitly holds — the storage API cannot enumerate.

## How this is tested

### 1. Anonymous RLS regression suite
`src/test/security-rls.test.ts` (Vitest) runs with only the anon key and asserts:
- Cannot read `orders`, `payments`, `notifications`, `order_status_history`.
- Cannot `UPDATE coupons.used_count`.
- Cannot `INSERT` into `orders`, `order_items`, `notifications`.
- Cannot enumerate `review-images` via the storage list API.
- Can `INSERT` a valid ad-analytics impression but cannot insert an invalid `event_type`.

Run locally: `bunx vitest run src/test/security-rls.test.ts`

### 2. Post-deploy scanner gate
`.github/workflows/security.yml` re-runs the suite and executes
`scripts/security-gate.mjs` against the latest scanner report. Any `error` or
`critical` finding fails the deploy.

### 3. Post-deploy diff check
`.github/workflows/security-postdeploy.yml` runs after every deployment,
compares the current scan against the last known snapshot in
`.security/last-scan.json`, and posts new or newly-elevated findings as a
workflow annotation. It never auto-ignores anything.

## Changing a policy
1. Open a migration that `DROP POLICY` + `CREATE POLICY` (do not `ALTER`).
2. Update the table entry above in the same PR.
3. Add or update a case in `security-rls.test.ts` that would fail without the
   new rule.
4. If the change affects realtime, add a comment on the table entry noting the
   broadcast scope.