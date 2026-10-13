import { expect, test } from "@playwright/test";

// Milestone 1 smoke test: the app shell renders, the global search bar
// opens Search on Enter (M1 AC1, AC11), and the layout holds with no
// horizontal scroll at 1024px and 1440px (brief 5.1.4, 7.4.1 done-when).
test("app shell renders and the global search bar opens Search", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "My worklist" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();

  const searchBox = page.getByRole("searchbox", { name: "Search by name, alias, LEI or BIC" });
  await searchBox.fill("mps");
  await searchBox.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=mps/);
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll, `unexpected horizontal scroll at ${width}px`).toBe(false);
  }

  await expect(page.getByRole("link", { name: "Corvane Customer Hub, go to Home" })).toBeVisible();
});
