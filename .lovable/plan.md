# Device image uploads

## Goal
Keep every existing image URL field, while adding device-file upload, preview, replace/edit, and remove controls across the website and Capacitor app. Existing subscriptions, points, authentication, permissions, and business rules remain unchanged.

## Scope
- Add one reusable image field that supports URL entry and Android/WebView file selection.
- Validate image type and size, compress large images, show upload progress/loading, and reset the file input so the same file can be selected again.
- Show a responsive preview with actions to replace or remove the image and a fallback for invalid URLs.
- Use existing storage and ownership rules:
  - profile photos → profile images
  - seller logos/covers → store assets
  - admin banners, brands, categories, subcategories, and showroom media → the existing platform image area
  - product, review, return, and chat images keep their existing specialized upload flows.
- Preserve legacy/external image URLs and their current saved values.

## Pages to update
- Profile avatar.
- Seller store logo and cover.
- Admin banners/ads.
- Admin showroom cover and logo.
- Admin brands logo and banner.
- Admin categories and subcategories image and banner.
- Reuse or align existing product/platform upload controls where needed without changing product logic.

## Safety and cleanup
- Store only storage paths where private signed access is required; retain public URLs where the current tables expect them.
- Restrict uploads to authenticated owners/admins through current policies; add only the minimal admin storage policy if an uncovered path requires it.
- Avoid deleting a previously saved file until the form save succeeds; clean up newly uploaded replacements and explicit removals safely.
- Do not edit subscription, points, billing, or notification-subscription code.

## Validation
- Test URL entry, device selection, preview, replacement, removal, save, cancel, and broken-image fallback.
- Test at Android portrait and landscape sizes in the WebView-compatible browser flow.
- Run TypeScript, lint, tests, and verify no subscription/points files changed.
