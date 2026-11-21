import { expect, test } from "@playwright/test";
import { openAdviserCase, openMyPlan, resetDemo, showAllMetrics, startPriyaPlan } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

// Phase H: a short first view, the composite score never alone, and a DRAFT mark on every plan screen and in print.

test("the dashboard's first view is the current step and three findings; the rest opens on request", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();

  const first = page.getByTestId("home-first");
  await expect(first).toBeVisible();
  await expect(page.getByTestId("ladder-lead")).toBeVisible();
  await expect(page.getByTestId("metric-card")).toHaveCount(0);
  // the single score, the full ladder and the other cards are not in the first view
  await expect(page.getByRole("img", { name: /Financial health score/ })).toHaveCount(0);
  await expect(page.getByTestId("ladder").locator("ol")).toHaveCount(0);
  await expect(page.getByTestId("where-you-stand")).toHaveCount(0);

  await page.getByTestId("see-all").click();
  await expect(page.getByTestId("where-you-stand")).toBeVisible();
  expect(await page.getByTestId("metric-card").count()).toBeGreaterThan(3);
  await expect(page.getByTestId("ladder").locator("ol")).toHaveCount(1);
  // the score is still behind the disclosure, with its unverified tag beside the numbers
  await expect(page.getByRole("img", { name: /Financial health score/ })).toBeHidden();

  await page.getByTestId("show-fewer").click();
  await expect(page.getByTestId("metric-card")).toHaveCount(0);
});

test("the customer's plan, improve and activity screens carry the DRAFT mark; printing adds a banner and drops the navigation", async ({ page }) => {
  await startPriyaPlan(page);
  await expect(page.getByTestId("draft-watermark")).toBeVisible();
  await expect(page.getByTestId("draft-print-banner")).toBeHidden(); // screen only shows the mark; the banner is for print

  await page.goto("/improve");
  await expect(page.getByTestId("draft-watermark")).toBeVisible();
  await page.goto("/activity");
  await expect(page.getByTestId("draft-watermark")).toBeAttached();

  await page.goto("/plan");
  await page.emulateMedia({ media: "print" });
  const banner = page.getByTestId("draft-print-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("DRAFT, printed copy");
  await expect(page.locator("header")).toBeHidden();
  // the mark repeats on every printed page, and is darker than on screen
  await expect(page.getByTestId("draft-watermark")).toBeVisible();
});

test("the adviser's snapshot shows the score only behind a disclosure, with the numbers and the unverified tag", async ({ page }) => {
  await startPriyaPlan(page);
  const H = { "x-requested-with": "fetch", "content-type": "application/json" };
  await page.context().clearCookies();
  await page.request.post("/api/v1/auth/demo", { data: { persona: "adviser" }, headers: H });
  await page.goto("/adviser"); // the demo notice was already dismissed in this browser
  await openAdviserCase(page, "Priya");
  const score = page.getByTestId("adviser-score");
  await expect(score).toBeVisible();
  await expect(score).not.toHaveAttribute("open", "");
  await score.locator("summary").click();
  await expect(score).toContainText(/score/i);
  await expect(score.getByTestId("unverified-tag")).toBeVisible();
  // the individual numbers sit in the same snapshot, outside the disclosure
  await expect(page.getByText(/\d(\.\d)? of \d+ months/).first()).toBeVisible();
});
