import "dotenv/config";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { db } from "@/server/db";
import { STORAGE_KEYS, chapterOf, type ChapterId } from "@/lib/onboarding/content";

import { resetDemoData } from "./fixtures/role-actions-setup";

/**
 * Guided moves: the bubble shows one action at a time, for the screen the visitor is on. These tests walk the chapters using only the bubbles:
 * each move's target is clicked where the ring is, "Got it" and "Fill for me" are used as offered, and every step must tick.
 * Runs on the role-actions project's production build (Mon 05 Oct 2026, 10:48 CEST), at 1280 x 800.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });

async function openPanel(page: Page, scenario: 1 | 2, chapter: ChapterId) {
  await page.addInitScript(
    ([welcome, mobile, panelKey, pref]) => {
      localStorage.setItem(welcome, "1");
      localStorage.setItem(mobile, "1");
      if (!localStorage.getItem(panelKey)) localStorage.setItem(panelKey, pref);
    },
    [STORAGE_KEYS.welcomeDismissed, STORAGE_KEYS.mobileDismissed, STORAGE_KEYS.panel, JSON.stringify({ scenario, chapter, collapsed: false, closedPrologues: [], openedPrologues: [] })],
  );
}

const bubbleOf = (page: Page) => page.locator("[data-onboarding-bubble]");
const ringOf = (page: Page) => page.locator("[data-onboarding-highlight]");
const panelOf = (page: Page) => page.getByRole("complementary", { name: /^Scenario/ });
const stepOf = (page: Page, id: string) => panelOf(page).locator(`[data-onboarding-step="${id}"]`);

interface Seen {
  key: string;
  text: string;
  kind: "got-it" | "fill" | "click" | "press";
}

/** Waits until a box stops moving (the page scrolls to the target first). */
async function steady(l: Locator) {
  let last = "";
  await expect
    .poll(async () => {
      const b = await l.boundingBox();
      const now = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}` : "none";
      const same = now === last && now !== "none";
      last = now;
      return same;
    })
    .toBe(true);
}

/**
 * Follows the bubbles until `finished()`: waits for a bubble, checks it sits inside the page (not under the panel) and not over its target, does what
 * it offers (Got it, Fill for me, or a click where the ring is, or Enter), and waits for the guide to move on. Returns what it saw, in order.
 */
async function walk(page: Page, finished: () => Promise<boolean>, max = 120): Promise<Seen[]> {
  const seen: Seen[] = [];
  for (let n = 0; n < max; n++) {
    if (await finished()) return seen;
    const bubble = bubbleOf(page);
    // The panel reads the data every few seconds, so the end can show a moment after the last click: wait for a bubble or for the end.
try {
          await expect.poll(async () => (await finished()) || (await bubble.count()) > 0, { timeout: 45_000, message: "no bubble and not finished; last: " + seen.slice(-3).map((s) => s.key + "=" + s.text).join(" | ") }).toBe(true);
    } catch (e) {
      throw new Error("DBG url=" + page.url() + " main=" + ((await page.locator("main").innerText().catch(() => "")).slice(0, 400)) + " :: " + String(e));
    }
    if (await finished()) return seen;
    await expect(bubble).toBeVisible();
    const key = (await bubble.getAttribute("data-onboarding-bubble"))!;
    const text = (await bubble.locator('[data-onboarding="bubble-text"]').innerText()).trim();
    const ring = ringOf(page);
    await steady(ring);
    await steady(bubble);
    const [b, r] = [(await bubble.boundingBox())!, (await ring.boundingBox())!];
    // Inside the page (the panel takes the right 360 px at 1280 px wide), and never over its own target.
    expect(b.x, `${key}: bubble left`).toBeGreaterThanOrEqual(0);
    expect(b.y, `${key}: bubble top`).toBeGreaterThanOrEqual(0);
    // The panel takes the right 360 px; a drawer's own buttons (Report issue) sit over it, and then the whole window is the page.
    const inDialog = (await page.locator('[role="dialog"]:not([data-onboarding-bubble])').count()) > 0; // a dialog covers the panel too
    const overPanel = inDialog || r.x + r.width > 1280 - 360 + 4;
    expect(b.x + b.width, `${key}: bubble right edge`).toBeLessThanOrEqual((overPanel ? 1280 : 1280 - 360) + 1);
    expect(b.y + b.height, `${key}: bubble bottom edge`).toBeLessThanOrEqual(800 + 1);
    // Never over its own target, unless the target is as big as the page (then the bubble sits in its corner: data-side="inside").
    const overlap = b.x < r.x + r.width - 2 && b.x + b.width > r.x + 2 && b.y < r.y + r.height - 2 && b.y + b.height > r.y + 2;
    if ((await bubble.getAttribute("data-side")) !== "inside") expect(overlap, `${key}: bubble covers its target`).toBe(false);

    // Every bubble shows its counter, View as included.
    await expect(bubble.locator('[data-onboarding="bubble-counter"]'), `${key}: counter`).toHaveText(/^\d+ of \d+$/);
    // In a dialog or drawer the bubble never covers the footer buttons (unless its own target is one of them).
    const footers = page.locator('[data-onboarding="dialog-footer"]');
    if ((await footers.count()) > 0) {
      const f = (await footers.last().boundingBox())!;
      const targetInFooter = r.x >= f.x - 2 && r.y >= f.y - 4 && r.x + r.width <= f.x + f.width + 2 && r.y + r.height <= f.y + f.height + 4;
      const covers = b.x < f.x + f.width && b.x + b.width > f.x && b.y < f.y + f.height && b.y + b.height > f.y;
      if (!targetInFooter) expect(covers, `${key}: bubble covers the dialog footer`).toBe(false);
    }

    let kind: Seen["kind"] = "click";
    if (await bubble.getByRole("button", { name: "Got it" }).count()) {
      kind = "got-it";
      await bubble.getByRole("button", { name: "Got it" }).click();
    } else if (await bubble.getByRole("button", { name: "Fill for me" }).count()) {
      kind = "fill";
      await bubble.getByRole("button", { name: "Fill for me" }).click();
    } else {
      // A click where the ring is: whatever is under it is the target.
      const target = (await ring.boundingBox())!;
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
      if (/^Press /.test(text)) {
        kind = "press";
        await page.keyboard.press("Enter");
      }
    }
    seen.push({ key, text, kind });
    // The guide moves on: another move, another phase of the same one (a select that opened), or no bubble at all.
    await expect
      .poll(
        async () => {
          const again = bubbleOf(page);
          if ((await again.count()) === 0) return "gone";
          const k = await again.first().getAttribute("data-onboarding-bubble");
          const t = await again.first().locator('[data-onboarding="bubble-text"]').innerText().catch(() => "");
          return k === key && t.trim() === text ? "same" : "moved";
        },
        { timeout: 45_000, message: `the guide did not move on from "${text}" (${key})` },
      )
      .not.toBe("same");
  }
  throw new Error(`The guide did not finish in ${max} moves. Last: ${JSON.stringify(seen.slice(-4))}`);
}

const doneIds = async (page: Page) =>
  panelOf(page)
    .locator('[data-onboarding-step][data-state="done"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-onboarding-step")));

test.beforeEach(async ({ request }) => {
  test.setTimeout(420_000);
  await resetDemoData(request);
  // Clipboard and Gmail are not part of what is tested.
});

test.describe("chapter 1a, by the bubbles only", () => {
  test("View as, Home, the row, the issue, the log, Compliance, the Update: every step ticks", async ({ page }) => {
    await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
    await openPanel(page, 1, "1a");
    await page.goto("/");
    await expect(panelOf(page)).toBeVisible();

    // The first bubble is on View as (the visitor starts as Adrian Koh), then on the option.
    await expect(bubbleOf(page)).toContainText("Open View as");
    await expect(ringOf(page)).toHaveAttribute("data-onboarding-highlight", "view-as");
    const seen = await walk(page, async () => (await panelOf(page).locator('[data-onboarding="chapter-end"]').count()) > 0);

    expect(seen.map((s) => s.text)).toEqual([
      "Open View as",
      "Pick Customer Success · Emma Wilson",
      "Emma's issue. Service is back; her next update to MPS is due soon.",
      "Click ISS-1042",
      "Emma's next action is the MPS update, with its deadline.",
      "Overnight, in order: alert, acknowledged in 9 minutes, customer told, service restored at 22:30.",
      "Kevin's message to Silvia at night. Emma reads what was promised.",
      "MPS is under DORA. Compliance assessed a possible major incident.",
      "MPS needed the facts within 2 hours. Kevin sent them at 22:40.",
      "Write what Ops is doing now.",
      "Click Copy message",
      "Click Record update",
      "Open Channel, then pick Email.",
      "Pick Email",
      "Click Record notification",
    ]);
    expect(await doneIds(page)).toEqual(["s1-home", "s1-issue", "s1-log", "s1-compliance", "s1-update"]);
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    const update = await db.issueCommunication.findFirst({ where: { issueId: iss.id, type: "UPDATE", recordedBy: { team: "CS" } } });
    expect(update?.message).toContain("What we are doing: The certificate is renewed and Ops keeps watching the endpoint.");
    await expect(panelOf(page).locator('[data-onboarding="chapter-end"]')).toContainText(chapterOf("1a").end.text);
  });
});

test.describe("chapter 1b, by the bubbles only", () => {
  test("Resolve, Confirm resolution, Share draft, Approve, Send, and the closing words on Home", async ({ page }) => {
    await page.context().route("https://mail.google.com/**", (r) => r.fulfill({ body: "ok" }));
    await openPanel(page, 1, "1b");
    await page.goto("/");
    const seen = await walk(page, async () => (await panelOf(page).locator('[data-onboarding="chapter-end"]').count()) > 0);
    const texts = seen.map((s) => s.text);

    // Every person is reached through View as, in order: Kevin, Emma, Kevin, Mei, Kevin.
    const picks = texts.filter((t) => t.startsWith("Pick ") && t.includes("·")).map((t) => t.replace("Pick ", ""));
    expect(picks).toEqual(["Ops · Kevin Lim", "Customer Success · Emma Wilson", "Ops · Kevin Lim", "Compliance · Mei Chen", "Ops · Kevin Lim"]);
    for (const expected of [
      "Click Resolve",
      "Write the root cause.",
      "Click Resolve issue",
      "Click Go to the message",
      "Click Confirm resolution with the customer",
      "Click Confirm resolution",
      "Click Share draft",
      "Use the example link on the approved host.",
      "Write one sentence of summary.",
      "Click Approve report",
      "Click Approve report to confirm.",
      "Click Record report sent",
      "ISS-1042 closed itself. Nothing is left on anyone's Home.",
    ])
      expect(texts, expected).toContain(expected);
    expect(await doneIds(page)).toEqual(["s1b-resolve", "s1b-confirm", "s1b-share", "s1b-approve", "s1b-send"]);
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    expect(iss.status).toBe("CLOSED");
    // The example link went into the field as the approved host allows, and the draft was shared.
    const task = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: iss.id } });
    expect(task.draftLink).toContain("docs.corvane-internal.example");
  });
});

test.describe("scenario 2, by the bubbles only", () => {
  test("search, the Lloyds page, the Partner tab, the report form, Acknowledge, Degraded, linked issues, Revolut, Resolve", async ({ page }) => {
    await openPanel(page, 2, "2");
    await page.goto("/");
    const seen = await walk(page, async () => (await panelOf(page).locator('[data-onboarding="chapter-end"]').count()) > 0, 160);
    const texts = seen.map((s) => s.text);

    // Step 1: the person, then the platform by real clicks.
    expect(texts.slice(0, 8)).toEqual([
      "Open View as",
      "Pick Network · Lukas Brenner",
      "Type Lloyds in the search bar.",
      "Press Enter to search.",
      "Click Lloyds Bank plc",
      "Click the Partner tab",
      "These customers send checks through Lloyds. All of them are affected.",
      "Click Home",
    ]);
    for (const expected of [
      "Click Report issue",
      "Type Lloyds.",
      "Pick Lloyds Bank plc",
      "Pick UK CoP / GB",
      "Summarise Paul's message in the description.",
      "Pick Found by Corvane",
      "Pick Degraded",
      "Pick No for possible data breach.",
      "Click Acknowledge",
      "Click Set to Degraded",
      "Click Save status",
      "Click Create linked issues",
      "Click Create",
      "Click the Notify Revolut Ltd row",
      "Click Record notification",
    ])
      expect(texts, expected).toContain(expected);
    expect(await doneIds(page)).toEqual(["s2-impact", "s2-report", "s2-degraded", "s2-linked", "s2-notify", "s2-resolve"]);

    // The report was filed with Degraded impact, so it is not a Sev-1.
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    const parent = await db.issue.findFirstOrThrow({ where: { entityId: lloyds.id, type: "PARTNER_DEGRADED", parentLinks: { none: {} } }, orderBy: { createdAt: "desc" } });
    expect(parent.impact).toBe("DEGRADED");
    expect(parent.severity).not.toBe("SEV1");
    expect(parent.status).toBe("RESOLVED");
    const child = await db.issue.findFirstOrThrow({ where: { entity: { legalName: "Revolut Ltd" }, parentLinks: { some: { parentId: parent.id } } } });
    expect(child.status).toBe("RESOLVED");
  });
});

test.describe("the panel around the bubble", () => {
  test("the current step shows Now with Show me and Skip ahead; there is no Do this block and no Take me there", async ({ page }) => {
    await openPanel(page, 1, "1b");
    await page.goto("/");
    const current = stepOf(page, "s1b-resolve");
    await expect(current).toHaveAttribute("data-state", "current");
    await expect(current.locator('[data-onboarding="now"]')).toContainText("Now: Open View as");
    await expect(current.getByRole("button", { name: "Show me" })).toBeVisible();
    await expect(current.getByRole("button", { name: "Skip ahead" })).toBeVisible();
    await expect(panelOf(page).getByText("Do this", { exact: true })).toHaveCount(0);
    await expect(panelOf(page).getByRole("button", { name: "Take me there" })).toHaveCount(0);
    for (const id of ["s1b-confirm", "s1b-share", "s1b-approve", "s1b-send"]) await expect(stepOf(page, id)).toHaveAttribute("data-state", "later");
  });

  test("Esc hides the bubble and Show me brings it back; the target stays usable", async ({ page }) => {
    await openPanel(page, 1, "1b");
    await page.goto("/");
    await expect(bubbleOf(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bubbleOf(page)).toHaveCount(0);
    await expect(ringOf(page)).toHaveCount(0);
    // The target (View as) still opens, with the bubble hidden.
    await page.getByRole("combobox", { name: "View as" }).click();
    await page.keyboard.press("Escape");
    await stepOf(page, "s1b-resolve").getByRole("button", { name: "Show me" }).click();
    await expect(bubbleOf(page)).toBeVisible();
  });

  test("Skip ahead from Home in scenario 2 lands on the Partner tab as Lukas, and the guide goes on from there", async ({ page }) => {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    await openPanel(page, 2, "2");
    await page.goto("/");
    await stepOf(page, "s2-impact").getByRole("button", { name: "Skip ahead" }).click();
    await expect(page).toHaveURL(new RegExp(`/entities/${lloyds.id}/partner$`));
    await expect(page.getByText("You are now Lukas Brenner (Network)")).toBeVisible();
    await expect(bubbleOf(page)).toContainText("These customers send checks through Lloyds");
    await expect(ringOf(page)).toHaveAttribute("data-onboarding-highlight", "partner-customers");
    await bubbleOf(page).getByRole("button", { name: "Got it" }).click();
    await expect(stepOf(page, "s2-impact")).toHaveAttribute("data-state", "done");
    await expect(stepOf(page, "s2-report")).toHaveAttribute("data-state", "current");
  });

  test("off the path: no bubble, 'You are off the path.', and Back on track goes to the page of the next move", async ({ page }) => {
    const iss = await db.issue.findUniqueOrThrow({ where: { number: 1042 } });
    await openPanel(page, 1, "1a");
    await page.goto("/");
    // Get to the issue as Emma by the bubbles, then wander off to the search page.
    await walk(page, async () => (await page.url()).includes(`/issues/${iss.id}`), 12);
    await page.goto("/search?q=Santander");
    const current = panelOf(page).locator('[data-onboarding-step][data-state="current"]');
    await expect(current.locator('[data-onboarding="off-path"]')).toContainText("You are off the path.");
    await expect(bubbleOf(page)).toHaveCount(0);
    await current.getByRole("button", { name: "Back on track" }).click();
    await expect(page).toHaveURL(new RegExp(`/issues/${iss.id}$`));
    await expect(bubbleOf(page)).toBeVisible({ timeout: 20_000 });
  });

  test("the moves done are remembered after a reload, and the prologue folds once the first step is done", async ({ page }) => {
    await openPanel(page, 1, "1a");
    await page.goto("/");
    await expect(panelOf(page).locator('[data-onboarding="prologue"]')).toContainText(chapterOf("1a").prologue[0]);
    await walk(page, async () => (await stepOf(page, "s1-home").getAttribute("data-state")) === "done", 12);
    await expect(panelOf(page).locator('[data-onboarding="prologue"]')).not.toContainText(chapterOf("1a").prologue[0]);
    await page.reload();
    await expect(stepOf(page, "s1-home")).toHaveAttribute("data-state", "done");
    await expect(stepOf(page, "s1-issue")).toHaveAttribute("data-state", "current");
  });

  test("with reduced motion the ring does not pulse; otherwise it does", async ({ page }) => {
    await openPanel(page, 1, "1b");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(ringOf(page)).toBeVisible();
    expect(await ringOf(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("ch-highlight-pulse");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => ringOf(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    // The bubble is a non-modal dialog with polite text.
    await expect(bubbleOf(page)).toHaveAttribute("role", "dialog");
    await expect(bubbleOf(page)).toHaveAttribute("aria-modal", "false");
    await expect(bubbleOf(page).locator("[aria-live=polite]")).toBeVisible();
  });
});
