import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.fill('input[type="email"]', process.env.PLAYWRIGHT_TEST_EMAIL ?? "");
  await page.fill('input[type="password"]', process.env.PLAYWRIGHT_TEST_PASSWORD ?? "");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|portfolios|estate|scenarios)/, { timeout: 15_000 });
}

test.describe("Portfolio Analysis page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/portfolio-analysis");
  });

  test("loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("shows Portfolio Analysis heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Portfolio Analysis" })).toBeVisible();
  });

  test("shows Portfolio Analysis section divider", async ({ page }) => {
    const dividers = page.locator("h2").filter({ hasText: "Portfolio Analysis" });
    await expect(dividers.first()).toBeVisible();
  });

  test("shows AI Analysis section divider", async ({ page }) => {
    await expect(page.locator("h2").filter({ hasText: "AI Analysis" })).toBeVisible();
  });
});

test.describe("Sidebar navigation", () => {
  test("sidebar has Portfolio Analysis link under Planning", async ({ page }) => {
    await login(page);
    await page.goto("/portfolio-analysis");
    const sidebarLink = page.locator('nav a[href="/portfolio-analysis"]');
    await expect(sidebarLink).toBeVisible();
  });
});

test.describe("/portfolios page cleanup", () => {
  test("portfolios page no longer has AI Analysis section header", async ({ page }) => {
    await login(page);
    await page.goto("/portfolios");
    await page.waitForLoadState("networkidle");
    const aiAnalysisHeader = page.locator("h2").filter({ hasText: "AI Analysis" });
    await expect(aiAnalysisHeader).toHaveCount(0);
  });
});

test.describe("next-section banner chain", () => {
  test("expenditures NextSectionBanner links to /portfolio-analysis", async ({ page }) => {
    await login(page);
    await page.goto("/expenditures");
    await page.waitForLoadState("networkidle");
    const banner = page.locator('a[href="/portfolio-analysis"]');
    await expect(banner).toBeVisible();
  });

  test("portfolio-analysis NextSectionBanner links to /estate", async ({ page }) => {
    await login(page);
    await page.goto("/portfolio-analysis");
    await page.waitForLoadState("networkidle");
    const banner = page.locator('a[href="/estate"]');
    await expect(banner).toBeVisible();
  });
});
