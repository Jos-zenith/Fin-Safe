import { expect, test, type Page } from "@playwright/test";
import { openMyPlan, resetDemo, requestReview, showAllMetrics } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

// The happy path uses the "Use demo answers" shortcut. These tests walk the real intake instead:
// every question, the UPI keypad, and the add-a-loan / add-a-goal sub-flows.
const digits = async (page: Page, n: string) => {
  for (const d of n) await page.getByRole("button", { name: d, exact: true }).click();
};
const next = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();

test("Priya: six core questions give a first result, with a metric stack and no headline score", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await expect(page.getByText(/Step 1 of 6/)).toBeVisible();

  for (let i = 0; i < 3; i++) await next(page); // income, essential spending, savings (prefilled)
  await page.getByRole("button", { name: "No loans" }).first().click();
  await next(page); // dependents
  await page.getByRole("button", { name: "Looks right" }).click(); // main goal

  await page.getByRole("button", { name: "See my financial health" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // the first view is short; "Where you stand" is one tap away
  await showAllMetrics(page);

  // "Where you stand": separate checks, each with its own number and a text status
  const stand = page.getByTestId("where-you-stand");
  await expect(stand).toBeVisible();
  await expect(stand.getByText("Emergency fund")).toBeVisible();
  await expect(stand.getByText("1.8 months")).toBeVisible();
  await expect(stand.getByText("Look first").first()).toBeVisible();
  // the single score is not the headline: it only appears after opening "About this summary"
  await expect(stand.getByRole("img", { name: /Financial health score/ })).toBeHidden();
  await stand.getByText("About this summary").click();
  await expect(stand.getByText(/One number cannot describe a financial life/)).toBeVisible();
  await expect(stand.getByTestId("unverified-tag")).toBeVisible();

  // optional answers sharpen it; Priya (a persona) still has them to give
  await expect(page.getByTestId("improve-accuracy")).toBeVisible();
});

test("Start fresh: six answers, a loan and a goal, then 'Improve accuracy' steps on the dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Start Financial Health Check" }).first().click();
  await expect(page.getByText(/Step 1 of 6/)).toBeVisible();

  await digits(page, "30000");
  await next(page); // monthly income
  await digits(page, "15000");
  await next(page); // essentials
  await digits(page, "20000");
  await next(page); // emergency savings

  // add a loan: 1,00,000 at 18% with a 5,000 EMI
  await page.getByRole("button", { name: "Add a loan" }).click();
  await digits(page, "100000");
  await next(page);
  await digits(page, "18");
  await next(page);
  await digits(page, "5000");
  await next(page);

  await page.getByRole("button", { name: "+" }).click();
  await page.getByRole("button", { name: "+" }).click();
  await next(page); // two dependents

  // add a goal: education, 5,00,000, default 5 years
  await page.getByRole("button", { name: "Add a goal" }).click();
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await digits(page, "500000");
  await next(page);
  await next(page); // years (prefilled 5): adding the goal was the sixth and last core answer
  await page.getByRole("button", { name: "See my financial health" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await showAllMetrics(page);
  await expect(page.getByText("1.3 months").first()).toBeVisible(); // 20,000 / 15,000
  await expect(page.locator("#debt").getByText("Look first")).toBeVisible(); // 18% is above the 12% mark
  await expect(page.locator("#goal-g1")).toBeVisible();

  // an optional answer: other spending. It moves out of the list once given.
  const improve = page.getByTestId("improve-accuracy");
  await expect(improve).toBeVisible();
  await improve.getByRole("button", { name: /Show \d+ more/ }).click(); // the card lists four at first
  await improve.getByRole("button", { name: /Other spending/ }).click();
  await digits(page, "5000");
  await page.getByRole("dialog").getByRole("button", { name: "Continue", exact: true }).click();
  await expect(improve.getByRole("button", { name: /Other spending/ })).toHaveCount(0);

  await requestReview(page);
  await openMyPlan(page);
  await expect(page.getByText("Pay down costly loans first")).toBeVisible();
  await expect(page.getByText("Build your emergency reserve")).toBeVisible();
  // the DRAFT banner is on screen without scrolling, with the plain sentence
  const banner = page.getByTestId("draft-banner");
  await expect(banner).toContainText("Do not act on this yet");
  const box = await banner.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(860);
});

test("Settings shows the AI mode honestly (mock by default)", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByTestId("ai-mode")).toHaveText("Mock fixtures. No key needed.");
});

test("an unreachable AI route falls back to fixtures and the demo still works", async ({ page }) => {
  await page.route("**/api/ai", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await requestReview(page);
  await openMyPlan(page);
  await expect(page.getByText("AI DRAFT · NOT APPROVED ADVICE")).toBeVisible();
});
