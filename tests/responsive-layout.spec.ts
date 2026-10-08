import { expect, request, test } from "@playwright/test";

const portraitWidths = [360, 375, 390, 412] as const;
const comparisonIds = [
  "522fe3c6-4e6c-4142-9802-0ac1709b70a3",
  "c8d20f1f-f6e4-4e68-b990-2133fb8f0388",
];

let productPath: string;

test.beforeAll(async () => {
  const apiUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!apiUrl || !publishableKey) throw new Error("Missing public backend test configuration");

  const api = await request.newContext({
    extraHTTPHeaders: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
  });
  const response = await api.get(
    `${apiUrl}/rest/v1/products?select=id&is_active=eq.true&moderation_status=eq.approved&limit=1`,
  );
  expect(response.ok()).toBeTruthy();
  const products = (await response.json()) as Array<{ id: string }>;
  if (!products[0]?.id) throw new Error("No public product is available for responsive checks");
  productPath = `/product/${products[0].id}`;
  await api.dispose();
});

const expectNoDocumentOverflow = async (page: import("@playwright/test").Page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
};

for (const width of portraitWidths) {
  test.describe(`${width}px Android portrait`, () => {
    test.use({
      viewport: { width, height: Math.round(width * 2.15) },
      userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
    });

    for (const path of ["/", "/search", "/auth"]) {
      test(`${path} stays inside the viewport`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expectNoDocumentOverflow(page);
      });
    }

    test("compact header and bottom navigation remain stationary while scrolling", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const header = page.getByTestId("site-header");
      const bottom = page.getByTestId("mobile-bottom-bar");
      await expect(header).toBeVisible();
      await expect(bottom).toBeVisible();
      for (const scrollY of [600, 0, 900]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        const headerBox = await header.boundingBox();
        const bottomBox = await bottom.boundingBox();
        if (!headerBox || !bottomBox) throw new Error("Missing mobile bars");
        expect(headerBox.y).toBeCloseTo(0, 0);
        expect(headerBox.height).toBeLessThanOrEqual(96);
        expect(bottomBox.y + bottomBox.height).toBeCloseTo(page.viewportSize()?.height ?? 0, 0);
      }
      await header.getByRole("button", { name: "الفئات", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoDocumentOverflow(page);
    });

    test("product details stay inside the viewport", async ({ page }) => {
      await page.goto(productPath, { waitUntil: "domcontentloaded" });
      await expectNoDocumentOverflow(page);
    });

    test("comparison contains horizontal overflow within its matrix", async ({ page }) => {
      await page.goto(`/compare?products=${comparisonIds.join(",")}`, { waitUntil: "domcontentloaded" });
      const matrix = page.getByTestId("comparison-scroll");
      await expect(matrix).toBeVisible();
      await expectNoDocumentOverflow(page);
      const sizes = await matrix.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      expect(sizes.scroll).toBeGreaterThanOrEqual(sizes.client);
      await expect(page.getByRole("heading", { name: "مقارنة المنتجات" })).toBeVisible();
    });
  });
}

test.describe("Android landscape", () => {
  test.use({
    viewport: { width: 800, height: 360 },
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
  });

  test("search, comparison, and product pages stay inside the viewport", async ({ page }) => {
    for (const path of ["/search", `/compare?products=${comparisonIds.join(",")}`, productPath]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expectNoDocumentOverflow(page);
    }
  });
});