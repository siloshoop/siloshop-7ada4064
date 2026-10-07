# Project architecture rules
- Reset document scroll centrally inside BrowserRouter on every location change and pageshow, with native history restoration disabled, so browser and Capacitor back navigation start at the top.
- Buyer dashboard summary cards and quick access use router links; spending and rating summaries open existing orders rather than introducing new destinations.
- Use saved active variant quantities as the aggregate stock for variant products, with database stock guards and cleanup; all clients must observe the same availability without reserving stock in carts.
- Product listing cards navigate to details without cart mutations and refresh saved aggregate stock on mount, stock events, and focus, so cached listing results cannot disagree with detail availability.

- Keep intentionally wide comparison content inside its own horizontal scroller; never allow it to widen the document viewport, because Android WebViews clip document-level overflow unpredictably in RTL.
- Route every user-facing share through src/lib/share.ts and every file export through src/lib/exportFile.ts; they guarantee public production URLs and native (Capacitor Share/Filesystem) handling.
- Order tracking renders child-order statuses per seller, matches parent-held items by vendor, and uses a page-specific vertical timeline; this preserves independent saved shipment progress without changing other order screens.
- Order detail thumbnails use OrderProductImage to resolve stored paths and fall back from failed snapshots to accessible current product images without changing saved orders or weakening access policies.
- Cart quantity changes and saved-item transfers read current selected-variant/product stock before writing, with per-row mutation locks and database guards as final authority; stale views and repeated taps cannot bypass stock limits.
