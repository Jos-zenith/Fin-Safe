import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openMyPlan, completeAgreement, resetDemo, showAllMetrics, startPriyaPlan } from "./helpers";

// Layout checks at four widths. Screenshots go to test-results/screens; with SCREENSHOTS=1 they are written to
// docs/screenshots so the committed images show what was checked.
test.beforeEach(async ({ request }) => resetDemo(request));

const WIDTHS = [360, 768, 1280, 1536] as const;
const OUT = process.env.SCREENSHOTS ? path.resolve(__dirname, "../docs/screenshots") : path.resolve(__dirname, "../test-results/screens");
mkdirSync(OUT, { recursive: true });

const shot = (page: Page, name: string, w: number) => page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: false });
const noSideScroll = async (page: Page, where: string) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(o.sw, `${where}: horizontal scroll`).toBeLessThanOrEqual(o.iw + 1);
};
const H = { "x-requested-with": "fetch", "content-type": "application/json" };

for (const w of WIDTHS) {
  test.describe(`${w}px`, () => {
    test.use({ viewport: { width: w, height: w < 700 ? 780 : 900 } });

    test(`landing, dashboard and plan lay out for ${w}px`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Got it" }).click();
      await noSideScroll(page, "landing");
      await shot(page, "landing", w);

      await page.getByRole("button", { name: /Priya/ }).click();
      await page.getByRole("button", { name: "Use demo answers" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await noSideScroll(page, "home");
      // the first view is short: the step that comes first, at most three findings, and "See all metrics" within reach
      await expect(page.getByTestId("home-first")).toBeVisible();
      await expect(page.getByTestId("ladder-lead")).toBeVisible();
      expect(await page.getByTestId("metric-card").count(), "at most three findings in the first view").toBeLessThanOrEqual(3);
      await expect(page.getByTestId("where-you-stand")).toHaveCount(0);
      await expect(page.getByTestId("see-all")).toBeVisible();
      await shot(page, "home", w);

      await showAllMetrics(page);
      await noSideScroll(page, "home, all metrics");
      const stand = await page.getByTestId("where-you-stand").boundingBox();
      const card = await page.locator("#ef").boundingBox();
      if (w >= 1024) {
        // desktop: the metric stack and the metric cards sit side by side, not in one phone column
        expect(Math.abs(card!.x - stand!.x), "two or more columns").toBeGreaterThan(250);
      } else {
        expect(Math.abs(card!.x - stand!.x), "a single column").toBeLessThan(40);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, "home-all", w);

      // "Check your answers" and the agreement step
      await page.getByRole("button", { name: "Get my plan reviewed" }).first().click();
      await expect(page).toHaveURL(/\/confirm/);
      await noSideScroll(page, "confirm");
      await shot(page, "confirm", w);
      await page.getByRole("button", { name: "Confirm and continue" }).click();
      await expect(page).toHaveURL(/\/agreement/);
      await noSideScroll(page, "agreement");
      await shot(page, "agreement", w);
      await completeAgreement(page);
      await expect(page).toHaveURL(/\/plan/);
      const banner = await page.getByTestId("draft-banner").boundingBox();
      expect(banner!.y + banner!.height, "DRAFT banner above the fold").toBeLessThan(w < 700 ? 780 : 900);
      await expect(page.getByTestId("draft-watermark")).toBeVisible();
      await noSideScroll(page, "plan");
      await shot(page, "plan", w);
    });

    test(`adviser console and Second Opinion lay out for ${w}px`, async ({ page }) => {
      await page.request.post("/api/v1/auth/demo", { data: { persona: "adviser" }, headers: H });
      await page.goto("/adviser");
      await page.getByRole("button", { name: "Got it" }).click();
      await expect(page.getByRole("button", { name: /Ramesh/ })).toBeVisible();
      await noSideScroll(page, "adviser");
      if (w >= 1024) {
        await page.getByRole("button", { name: /Ramesh/ }).click();
        const split = page.getByTestId("split-pane");
        const queue = await page.getByRole("region", { name: /queue/i }).boundingBox();
        const detail = await page.getByRole("region", { name: /^Case$|case/i }).last().boundingBox();
        expect(queue && detail && detail.x > queue.x + queue.width - 8, "queue left, case right").toBeTruthy();
        // each side scrolls inside the viewport; the page itself does not
        const box = await split.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      }
      await shot(page, "adviser", w);

      await page.goto("/check");
      await page.getByRole("button", { name: "3% every month" }).click();
      await page.getByRole("button", { name: "Check message" }).click();
      await expect(page.getByTestId("check-found")).toBeVisible();
      // evidence-first framing is on screen without scrolling: count of signs, the uncertainty note, what it could not do
      for (const id of ["check-found", "check-limits"]) {
        const b = await page.getByTestId(id).boundingBox();
        expect(b!.y, id).toBeLessThan(w < 700 ? 780 : 900);
      }
      await noSideScroll(page, "check");
      await shot(page, "check", w);
    });
  });
}

test.describe("a centred reading column on wide screens", () => {
  test.use({ viewport: { width: 1536, height: 900 } });
  test("the Learn page is centred, not pinned to the left", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: "Got it" }).click();
    const h = await page.getByRole("heading", { level: 1 }).first().boundingBox();
    const left = h!.x;
    const right = 1536 - (h!.x + h!.width);
    expect(left, "has a left margin").toBeGreaterThan(100);
    expect(Math.abs(left - right), "margins roughly equal").toBeLessThan(400);
  });
  test("a customer plan page works through the whole flow at 1536px", async ({ page }) => {
    await startPriyaPlan(page);
    await expect(page.getByTestId("draft-banner")).toBeVisible();
  });
});
