import { expect, test } from "@playwright/test";

/**
 * Per-visitor demo clock (portfolio runtime). Runs under the `demo-clock-zones` project: a production build whose
 * DEMO_CLOCK_START is Tue 06 Oct 2026, 13:14 CEST and which has no DEMO_CLOCK_ANCHOR.
 */
const START_MS = new Date("2026-10-06T13:14:00+02:00").getTime();
const HOUR_MS = 60 * 60 * 1000;

async function demoNowMs(page: import("@playwright/test").Page): Promise<number> {
  // What the browser's own now() uses: the offset the server wrote into the page, applied to the browser's clock.
  return page.evaluate(() => Date.now() + (window as unknown as { __chClockOffsetMs: number }).__chClockOffsetMs);
}

test("a new visitor starts at DEMO_CLOCK_START and gets a 24 hour arrival cookie", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const before = Date.now();
  await page.goto("/");
  await expect(page.getByText(/Demo time: Tue 06 Oct, 13:1\d CEST/)).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === "ch_arrival");
  expect(cookie, "the first request sets ch_arrival").toBeDefined();
  expect(Math.abs(Number(cookie!.value) - before)).toBeLessThan(30_000);
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(23.9 * HOUR_MS);
  expect(cookie!.expires * 1000 - Date.now()).toBeLessThan(24.1 * HOUR_MS);
  expect(cookie!.httpOnly).toBe(true);

  expect(Math.abs((await demoNowMs(page)) - (START_MS + (Date.now() - Number(cookie!.value))))).toBeLessThan(90_000);
  await context.close();
});

test("a visitor who arrived two hours ago is two hours into the demo; a newcomer is back at the start", async ({ browser }) => {
  const returning = await browser.newContext();
  await returning.addCookies([{ name: "ch_arrival", value: String(Date.now() - 2 * HOUR_MS), url: "http://localhost:3102" }]);
  const returningPage = await returning.newPage();
  await returningPage.goto("/");
  await expect(returningPage.getByText(/Demo time: Tue 06 Oct, 15:1\d CEST/)).toBeVisible();

  const newcomer = await browser.newContext();
  const newcomerPage = await newcomer.newPage();
  await newcomerPage.goto("/");
  await expect(newcomerPage.getByText(/Demo time: Tue 06 Oct, 13:1\d CEST/)).toBeVisible();

  await returning.close();
  await newcomer.close();
});

test("an arrival cookie older than 24 hours, or in the future, is replaced rather than trusted", async ({ browser }) => {
  for (const value of [String(Date.now() - 3 * 24 * HOUR_MS), String(Date.now() + 5 * HOUR_MS), "tomorrow"]) {
    const context = await browser.newContext();
    await context.addCookies([{ name: "ch_arrival", value, url: "http://localhost:3102" }]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByText(/Demo time: Tue 06 Oct, 13:1\d CEST/), value).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "ch_arrival")!;
    expect(Math.abs(Number(cookie.value) - Date.now())).toBeLessThan(60_000);
    await context.close();
  }
});

test("a browser whose own clock is 10 minutes off still agrees with the server on the demo time", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.install({ time: new Date(Date.now() + 10 * 60_000) });
  await page.goto("/");
  const cookie = (await context.cookies()).find((c) => c.name === "ch_arrival")!;
  // The browser's real elapsed time since the arrival is what the server counts too (Date.now() here is the real clock).
  const expected = START_MS + (Date.now() - Number(cookie.value));
  expect(Math.abs((await demoNowMs(page)) - expected)).toBeLessThan(90_000);
  await context.close();
});
