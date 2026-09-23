import { expect, request, test, type Page } from "@playwright/test";

const androidViewports = [
  { name: "small portrait", width: 320, height: 640 },
  { name: "standard portrait", width: 393, height: 873 },
  { name: "large portrait", width: 480, height: 960 },
  { name: "small landscape", width: 640, height: 320 },
  { name: "large landscape", width: 740, height: 360 },
] as const;

const publicPages = [
  { name: "home", path: "/", barTestId: "mobile-bottom-bar" },
  { name: "categories", path: "/categories", barTestId: "mobile-bottom-bar" },
] as const;

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
  if (!products[0]?.id) throw new Error("No public product is available for the responsive product-page check");
  productPath = `/product/${products[0].id}`;
  await api.dispose();
});

const assertFooterClearsFixedBar = async (page: Page, barTestId: string) => {
  const footer = page.getByTestId("site-footer");
  const fixedBar = page.getByTestId(barTestId);
  const copyright = footer.getByText(/جميع الحقوق محفوظة/);
  const contact = footer.getByRole("link", { name: "اتصل بنا" });

  await expect(footer).toBeVisible();
  await expect(fixedBar).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const [footerBox, barBox, copyrightBox] = await Promise.all([
    footer.boundingBox(),
    fixedBar.boundingBox(),
    copyright.boundingBox(),
  ]);

  expect(footerBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect(copyrightBox).not.toBeNull();
  if (!footerBox || !barBox || !copyrightBox) return;

  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(barBox.y + 2);
  expect(copyrightBox.y + copyrightBox.height).toBeLessThanOrEqual(barBox.y + 2);

  await contact.scrollIntoViewIfNeeded();
  const [visibleContactBox, visibleBarBox] = await Promise.all([
    contact.boundingBox(),
    fixedBar.boundingBox(),
  ]);
  expect(visibleContactBox).not.toBeNull();
  expect(visibleBarBox).not.toBeNull();
  if (!visibleContactBox || !visibleBarBox) return;
  expect(visibleContactBox.y + visibleContactBox.height).toBeLessThanOrEqual(visibleBarBox.y + 2);

  const clickablePoint = {
    x: visibleContactBox.x + visibleContactBox.width / 2,
    y: visibleContactBox.y + visibleContactBox.height / 2,
  };
  const topElementTestId = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return element?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
  }, clickablePoint);
  expect(topElementTestId).toBe("site-footer");
};

for (const viewport of androidViewports) {
  test.describe(viewport.name, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
    });

    for (const target of publicPages) {
      test(`${target.name} footer clears the fixed bar`, async ({ page }) => {
        await page.goto(target.path, { waitUntil: "domcontentloaded" });
        await assertFooterClearsFixedBar(page, target.barTestId);
      });
    }

    test("product footer clears the fixed purchase bar", async ({ page }) => {
      await page.goto(productPath, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("mobile-product-bar")).toBeVisible();
      await assertFooterClearsFixedBar(page, "mobile-product-bar");
    });
  });
}