---
description: "Brand assets shipped by the siloshop design system (logos, icons, illustrations, photography, fonts, videos) with exact import paths. Read before adding any logo, icon, illustration, image, video, or font to the app: use these real assets instead of placeholders, stock photos, or generated images."
---

# siloshop — Assets

These files are copied into `src/design-system/{slug}/assets/` in this project — never generate, placeholder, or substitute an asset that exists here.

Raw files import directly, e.g. `import logo from "@/design-system/{slug}/assets/logos/logo.svg"`.
R2 pointer files (`.asset.json`) are imported as JSON — use the `url` property, e.g. `import hero from "@/design-system/{slug}/assets/hero.png.asset.json"` then `<img src={hero.url} />`.
The full machine-readable catalog lives in this library's `design-system.json` (`assets` array).

## Logos

- `@/design-system/{slug}/assets/showroom-demo/logo-gold.png` (png)
- `@/design-system/{slug}/assets/showroom-demo/logo-violet.png` (png)
- `@/design-system/{slug}/assets/siloshop-logo-full.png.asset.json` (png, R2 pointer)
- `@/design-system/{slug}/assets/siloshop-logo.png.asset.json` (png, R2 pointer)

## Images

- `@/design-system/{slug}/assets/blog-choose-product.jpg` (jpg)
- `@/design-system/{slug}/assets/blog-fashion-trends.jpg` (jpg)
- `@/design-system/{slug}/assets/blog-safe-shopping.jpg` (jpg)
- `@/design-system/{slug}/assets/blog-sellers-guide.jpg` (jpg)
- `@/design-system/{slug}/assets/faq-account.jpg` (jpg)
- `@/design-system/{slug}/assets/faq-orders.jpg` (jpg)
- `@/design-system/{slug}/assets/faq-products.jpg` (jpg)
- `@/design-system/{slug}/assets/faq-shipping.jpg` (jpg)
- `@/design-system/{slug}/assets/showroom-demo/featured-shoes.jpg` (jpg)
- `@/design-system/{slug}/assets/showroom-demo/featured-store.jpg` (jpg)
- `@/design-system/{slug}/assets/showroom-demo/luxury-fashion-product.jpg` (jpg)
- `@/design-system/{slug}/assets/showroom-demo/modern-clothing-store.jpg` (jpg)
- `@/design-system/{slug}/assets/showroom-demo/premium-product.jpg` (jpg)
- `@/design-system/{slug}/assets/syria-flag.png.asset.json` (png, R2 pointer)

