
# Platform Products Management System

Build an admin-only management area for "Platform Products" — products owned by the platform (not by sellers). Sellers keep their existing seller-owned products; a new flag distinguishes the two.

## 1. Database changes

Extend the existing `products` table (non-breaking) so we don't fragment the catalog:

- `product_type` text — `'platform' | 'seller'`, default `'seller'`.
- `sku` text (unique when not null).
- `discount_price` numeric (optional).
- `currency` text, default `'SYP'`.
- `sizes` text[] (available sizes).
- `colors` text[] (available colors).
- `images` text[] (gallery, in addition to existing `image_url` which stays as the main image).
- `weight` numeric (optional, kg).
- `is_active` boolean, default true.
- `source` text — future-proofing: `'manual' | 'supplier_api' | 'xml' | 'csv'`, default `'manual'`.
- `external_id` text — future supplier sync key (indexed, nullable).

RLS updates on `products`:
- Platform products (`product_type = 'platform'`): only admins can insert/update/delete. Everyone can read active platform products.
- Seller products: existing rules unchanged (`vendor_id = auth.uid()`).

For platform rows `vendor_id` will store the admin's user id (existing NOT NULL kept intact).

Categories & brands: tables already exist. Add admin-only write policies if missing so admins can manage them from the same dashboard.

## 2. Storage

Reuse the existing `product-images` bucket (public). Admin uploads land under `platform/{uuid}/...` to keep them organized.

## 3. Admin UI (`/admin/platform-products`)

Guarded by `useAdminCheck` + `RequireRole('admin')`.

- **List page**: table with filters (category, brand, status, stock), search by name/SKU, bulk actions (activate/deactivate/delete).
- **Create / Edit form**:
  - Name, SKU, brand (select), category (select), description.
  - Price, discount price, currency, stock quantity, weight.
  - Sizes / colors: tag input (chips).
  - Status toggle (Active/Inactive).
  - Image uploader: drag-and-drop, multi-file, reorder, choose main image (radio). Compressed client-side using existing helper.
- **Bulk import dialog**: accept `.xlsx` and `.csv`. Preview parsed rows in a table with per-row validation errors before committing. On confirm, insert in batches.
- **Categories & Brands manager**: simple CRUD dialogs from the same page.

## 4. Import format

Column headers (case-insensitive, both English and Arabic accepted):

```text
name, sku, brand, category, description, price, discount_price,
currency, stock_quantity, sizes, colors, weight, images, main_image, status
```

- `sizes` / `colors` / `images`: comma or `|` separated.
- `brand` / `category`: matched by name (Arabic or English); unknown values reported as errors — no silent creation.
- `status`: `active` / `inactive` (default active).
- Parsing done client-side with `xlsx` (SheetJS) which handles both formats. Rows validated via zod, then inserted with `product_type = 'platform'`, `source = 'csv'` or `'xlsx'`.

## 5. Sellers cannot touch platform products

- RLS blocks it at the database level.
- Existing vendor dashboard queries already scope by `vendor_id = auth.uid()` and will additionally filter `product_type = 'seller'` to be explicit.
- Public product pages/listings show both types; only the admin sees management for platform ones.

## 6. Future supplier sync (design only, not implemented now)

The `source` + `external_id` columns plus the existing `product_type` flag are enough to let a future edge function upsert supplier feeds without further schema changes:

```text
upsert products on (source, external_id) where product_type = 'platform'
```

No code for this now — just the columns.

## Files to add / change (technical)

- Migration: extend `products`, add indexes on `(product_type)`, `(source, external_id)`, unique on `sku` (partial where sku is not null), refresh RLS policies, add admin write policies on `categories` and `brands` if missing.
- `src/pages/admin/PlatformProducts.tsx` — list + filters + bulk actions.
- `src/pages/admin/PlatformProductForm.tsx` — create/edit form.
- `src/components/admin/PlatformProductImport.tsx` — Excel/CSV import dialog with preview & validation (uses `xlsx`).
- `src/components/admin/PlatformImageUploader.tsx` — drag-drop, reorder, main-image selector (wraps existing compression helper).
- `src/components/admin/CategoriesBrandsManager.tsx` — inline CRUD.
- Route registration in `src/App.tsx` under an admin-guarded section.
- Sidebar entry in the admin dashboard.

## Out of scope for this task

- Actual supplier API/XML sync jobs (columns only).
- Multi-currency conversion (currency stored as label; display uses existing `ل.س` formatting when `SYP`).
- Variant-level stock per size/color (single stock number for now; can layer variants later without breaking this schema).

Approve and I'll implement it end-to-end.
