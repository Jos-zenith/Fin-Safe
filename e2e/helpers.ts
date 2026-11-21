import { expect, type APIRequestContext, type Page } from "@playwright/test";

const H = { "x-requested-with": "fetch", "content-type": "application/json" };

/**
 * The demo accounts are shared on the server, so every test starts by putting each one back to its seeded state
 * (the same thing "Reset demo" does for the signed-in account).
 */
export async function resetDemo(request: APIRequestContext) {
  for (const persona of ["ramesh", "anita", "priya"]) {
    const signIn = await request.post("/api/v1/auth/demo", { data: { persona }, headers: H });
    expect(signIn.ok(), `sign in as ${persona}`).toBeTruthy();
    const reset = await request.post("/api/v1/me/reset", { data: {}, headers: H });
    expect(reset.ok(), `reset ${persona}`).toBeTruthy();
  }
  await request.post("/api/v1/auth/logout", { data: {}, headers: H });
}

/** The dashboard's first view is the current step and three findings. "See all metrics" opens the rest (idempotent). */
export async function showAllMetrics(page: Page) {
  const open = page.getByTestId("see-all");
  const fewer = page.getByTestId("show-fewer");
  await expect(open.or(fewer)).toBeVisible(); // wait for the page to settle before deciding
  if (await open.isVisible()) await open.click();
  await expect(fewer).toBeVisible();
}

/** Landing -> Priya -> demo answers -> request a review -> the "review requested" page. Works on a fresh browser context. */
export async function startPriyaPlan(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await requestReview(page);
  await openMyPlan(page);
}

/** The risk questionnaire and the demo consent that come before a case can be created. `answer` is the option index (0 to 3). */
export async function completeAgreement(page: Page, answer = 2) {
  await expect(page).toHaveURL(/\/agreement/);
  for (const q of ["cushion", "fall", "swing", "horizon", "years", "past"]) await page.locator(`[data-testid="risk-q-${q}"] input[value="${answer}"]`).check();
  await page.getByRole("checkbox", { name: /I have read this and I consent/ }).check();
  await page.getByRole("button", { name: "Agree (demo) and get my plan reviewed" }).click();
}

/** Ask for a review: dashboard button -> "Check your answers" -> risk questions and consent -> the plan. */
export async function requestReview(page: Page) {
  await page.getByRole("button", { name: "Get my plan reviewed" }).first().click();
  await expect(page).toHaveURL(/\/confirm/);
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await completeAgreement(page);
  await expect(page).toHaveURL(/\/case\/[^/]+\/review-requested/);
}

/** "My Plan": the draft while it is a draft, the reviewed plan once approved (the old /plan address redirects). */
export async function openMyPlan(page: Page) {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/(advice|case)\/[^/]+(\/approved)?$/);
}

/** The adviser acts on EVERY plan item (accepting each one still pending). Approve stays off until they have. */
export async function actOnEveryItem(page: Page, viaKeyboard = false) {
  const pending = page.locator('li[data-decision="pending"]');
  for (let n = await pending.count(); n > 0; n--) {
    const accept = pending.first().getByRole("button", { name: "Accept", exact: true });
    if (viaKeyboard) {
      await accept.focus();
      await page.keyboard.press("Enter");
    } else await accept.click();
    await expect(pending).toHaveCount(n - 1);
  }
}

/** The adviser console lists cases in a table (cards on a phone). Open one by the client name. */
export async function openAdviserCase(page: Page, name = "Priya") {
  const row = page.locator("tr:visible, li:visible").filter({ hasText: name }).filter({ has: page.getByRole("link", { name: /^(Open|View)$/ }) }).first();
  await row.getByRole("link", { name: /^(Open|View)$/ }).click();
  await expect(page).toHaveURL(/\/adviser\/case\/[^/]+$/);
}

/** From the case review to the approval checklist, once every item has a decision. */
export async function continueToApproval(page: Page) {
  const go = page.getByTestId("continue-approval");
  await expect(go).not.toHaveAttribute("aria-disabled", "true");
  await go.click();
  await expect(page).toHaveURL(/\/approve$/);
}
