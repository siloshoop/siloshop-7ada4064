# Project architecture rules
- Enrich legacy report RPC payloads with read-only, RLS-protected saved currency snapshots and paginate financial reads; never infer currencies from amounts or modify financial storage for presentation.
- Keep mobile Navbar in two compact rows; the bottom Categories control opens the Navbar-owned drawer through the siloshop:open-categories event to preserve one shared menu and all secondary controls, and inset side sheets using both browser and native safe-area values; this preserves access without occupying the scrolling viewport or system bars.
- Use overflow-x: clip rather than hidden on document roots so horizontal containment does not create an ancestor scroll container that disables sticky navigation.
- Reset document scroll centrally inside BrowserRouter on every location change and pageshow, with native history restoration disabled, so browser and Capacitor back navigation start at the top.
- Buyer dashboard summary cards and quick access use router links; spending and rating summaries open existing orders rather than introducing new destinations.
- Use saved active variant quantities as the aggregate stock for variant products, with database stock guards and cleanup; all clients must observe the same availability without reserving stock in carts.
- Product listing cards navigate to details without cart mutations and refresh saved aggregate stock on mount, stock events, and focus, so cached listing results cannot disagree with detail availability.
- All product listings use ProductCard, which resolves public seller names and saved review/merchandising metadata alongside stock refreshes; consistent presentation must not fabricate rankings or sponsorship.

- Keep intentionally wide comparison content inside its own horizontal scroller; never allow it to widen the document viewport, because Android WebViews clip document-level overflow unpredictably in RTL.
- Route every user-facing share through src/lib/share.ts and every file export through src/lib/exportFile.ts; they guarantee public production URLs and native (Capacitor Share/Filesystem) handling.
- Order tracking renders child-order statuses per seller, matches parent-held items by vendor, and uses a page-specific vertical timeline; this preserves independent saved shipment progress without changing other order screens.
- Order detail thumbnails use OrderProductImage to resolve stored paths and fall back from failed snapshots to accessible current product images without changing saved orders or weakening access policies.
- Cart quantity changes and saved-item transfers read current selected-variant/product stock before writing, with per-row mutation locks and database guards as final authority; stale views and repeated taps cannot bypass stock limits.
- ProductCard metadata/stock refreshes go through src/lib/productCardMeta.ts, which batches same-tick requests and shares only in-flight requests; no completed stock cache is allowed, so mount/focus/stock events still read fresh availability.
- Load hidden desktop menus only at desktop widths, mobile category lists on opening, and search suggestions on focus; this avoids competing with initial mobile content while preserving every control.
- Share public navigation lookups through namespaced React Query hooks and existing activation invalidation; this deduplicates remounts without colliding with page-specific query shapes.

- Route product image processing through the shared crop dialog and imageCrop helpers, upload approved files unchanged, and create a separate bounded AI transport copy; chosen output dimensions must survive every seller/admin upload path.
- Never force lazily used libraries (charts, export tools) into manualChunks vendor groups; Rollup then preloads them on every page.
- FavoriteButton status checks go through src/lib/favoriteStatus.ts, which batches same-tick checks per user without caching completed results, so listings make one request instead of one per card.
- Coupon and sale pricing are computed only in public.line_pricing/coupon_allocate (used by quote_cart_coupon and create_order, with coupon row locks and coupon_redemptions reservations released by order status); clients only display server quotes so totals cannot drift.

- Render product bulk actions in normal document flow after the last selected visible row; this keeps actions aligned without covering adjacent content.
