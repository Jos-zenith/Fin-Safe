import { expect, test, type Page } from "@playwright/test";
import { openAdviserCase, continueToApproval, openMyPlan, actOnEveryItem, completeAgreement, resetDemo, requestReview, showAllMetrics, startPriyaPlan } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

const digits = async (page: Page, n: string) => {
  for (const d of n) await page.getByRole("button", { name: d, exact: true }).click();
};
const next = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();

/** Start fresh, then answer the six core questions with the shortfall scenario. */
async function shortfallJourney(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Start Financial Health Check" }).first().click();
  await expect(page.getByText(/Step 1 of 6/)).toBeVisible();
  await digits(page, "25000");
  await next(page); // income
  await digits(page, "18000");
  await next(page); // essentials
  await digits(page, "40000");
  await next(page); // savings
  await page.getByRole("button", { name: "Add a loan" }).click();
  await digits(page, "400000");
  await next(page);
  await digits(page, "11");
  await next(page);
  await digits(page, "10000");
  await next(page); // EMI
  await next(page); // dependents: none
  await page.getByRole("button", { name: "Add a goal" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await digits(page, "1500000");
  await next(page);
  await next(page); // years (prefilled)
  await page.getByRole("button", { name: "See my financial health" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("shortfall (25,000 income, 18,000 essentials, 10,000 EMIs): cash flow comes first and no goal amount is shown", async ({ page }) => {
  await shortfallJourney(page);

  // the dashboard leads with the blocking step, and the goal is "later"
  const lead = page.getByTestId("ladder-lead");
  await expect(lead).toContainText("Fix cash flow first");
  await expect(page.getByTestId("ladder")).toHaveAttribute("data-blocker", "cash_flow");
  await expect(page.getByTestId("ladder")).toContainText("-₹3,000");
  // the first view has no goal card; "See all measures" shows it as "later"
  await expect(page.locator("#goal-g1")).toHaveCount(0);
  await showAllMetrics(page);
  const goal = page.locator("#goal-g1");
  await expect(goal).toContainText("Later");
  await expect(goal).not.toContainText(/a month/i);
  await expect(page.locator("main")).not.toContainText("Range for discussion");

  // the plan: the first item is the cash-flow step, the goal is a "later" item, the explorer refuses to draw a SIP
  await requestReview(page);
  await openMyPlan(page);
  await expect(page.getByTestId("draft-banner")).toBeVisible();
  const first = page.locator("ol > li").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
  await expect(first.getByRole("heading", { level: 3 })).toContainText("Fix your monthly cash flow first");
  // the plan shows three options first; the goal, which comes later, is among the rest
  await page.getByRole("button", { name: /Show \d+ more options/ }).click();
  await expect(page.getByText("comes after the steps above")).toBeVisible();
  await expect(page.getByTestId("goal-explorer-later")).toContainText("Fix cash flow first");
  await expect(page.getByRole("slider")).toHaveCount(0);

  // Hindi and Tamil: the same order, in their own words, still with no goal amount
  await page.locator("header").getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByRole("heading", { level: 3 }).first()).toContainText("पहले अपना मासिक नकदी-प्रवाह ठीक करें");
  await expect(page.getByTestId("goal-explorer-later")).toBeVisible();
  await page.locator("header").getByRole("button", { name: "தமிழ்" }).click();
  await expect(page.getByRole("heading", { level: 3 }).first()).toContainText("முதலில் உங்கள் மாதாந்திரப் பணப்புழக்கத்தைச் சரிசெய்யுங்கள்");
  await expect(page.getByTestId("goal-explorer-later")).toBeVisible();
});

test("a healthy profile still gets its monthly goal range and the explorer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await expect(page.getByTestId("ladder")).toHaveAttribute("data-blocker", "");
  await showAllMetrics(page);
  await expect(page.locator("#goal-g1")).toContainText("₹");
  await requestReview(page);
  await openMyPlan(page);
  await expect(page.getByRole("slider")).toBeVisible();
});

test("existing goal savings change the monthly figure on the dashboard (intake -> engine -> screen)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await expect(page.getByText(/Step 1 of 6/)).toBeVisible();
  for (let i = 0; i < 3; i++) await next(page);
  await page.getByRole("button", { name: "No loans" }).first().click();
  await next(page);
  await page.getByRole("button", { name: "Looks right" }).click();
  await page.getByRole("button", { name: "See my financial health" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await showAllMetrics(page);
  const card = page.locator("#goal-g1");
  const before = (await card.innerText()).match(/₹[\d,]+/g)?.join(" ") ?? "";
  expect(before).toBeTruthy();

  // answer the optional "already set aside" question for the home goal
  await page.getByTestId("improve-accuracy").getByRole("button", { name: /Savings already set aside for goals/ }).click();
  await digits(page, "300000");
  await next(page); // first goal
  await next(page); // second goal (travel), left at zero
  const after = (await card.innerText()).match(/₹[\d,]+/g)?.join(" ") ?? "";
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
});

// ---------------------------------------------------------------------------------------------------------------
// Phase C: irregular income, missing data and confidence, the "Check your answers" step
// ---------------------------------------------------------------------------------------------------------------
const BASE = "http://localhost:3100";

test("Check your answers: the customer unticks one answer and the adviser sees it was never confirmed", async ({ browser }) => {
  const customerCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 412, height: 860 }, locale: "en-IN" });
  const adviserCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 860 }, locale: "en-IN" });
  const customer = await customerCtx.newPage();
  const adviser = await adviserCtx.newPage();

  await customer.goto("/");
  await customer.getByRole("button", { name: "Got it" }).click();
  await customer.getByRole("button", { name: /Priya/ }).click();
  await customer.getByRole("button", { name: "Use demo answers" }).click();
  await customer.getByRole("button", { name: "Get my plan reviewed" }).first().click();
  await expect(customer).toHaveURL(/\/confirm/);

  // every input is listed, each with an edit link; nothing has gone to a reviewer yet
  const list = customer.getByTestId("confirm-list");
  await expect(list.locator("li")).toHaveCount(15);
  await expect(list.getByRole("button", { name: /Edit: Monthly income/ })).toBeVisible();
  await customer.getByRole("checkbox", { name: "Investments you hold: This is right" }).uncheck();
  await expect(customer.getByText("1 not ticked yet. The reviewer will see which.")).toBeVisible();
  await customer.getByRole("button", { name: "Confirm and continue" }).click();
  await completeAgreement(customer);
  await expect(customer).toHaveURL(/\/review-requested/);

  await adviser.goto("/");
  await adviser.getByRole("button", { name: "Got it" }).click();
  await adviser.getByRole("button", { name: /Adviser console/ }).click();
  await expect(adviser).toHaveURL(/\/adviser/);
  await openAdviserCase(adviser, "Priya");
  await expect(adviser.getByTestId("confirmation-status")).toContainText("Not confirmed by the customer: Investments you hold");
  await expect(adviser.getByTestId("confirmation-status")).not.toContainText("Monthly income");
  // an adviser page left open would claim the NEXT test's case by itself
  await customerCtx.close();
  await adviserCtx.close();
});

test("a default is shown as a default and starts unticked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Ramesh/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await page.goto("/confirm"); // Ramesh already has a seeded case, so the dashboard has no review button
  const employer = page.locator('[data-field="employerTermCover"]');
  await expect(employer).toHaveAttribute("data-status", "default");
  await expect(employer.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator('[data-field="incomeMonths"]')).toHaveAttribute("data-status", "default");
  await expect(page.locator('[data-field="monthlyIncome"]').getByRole("checkbox")).toBeChecked();
});

test("irregular income: entering a bad month replaces the defaults, and the reserve target moves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Ramesh/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await showAllMetrics(page);
  await expect(page.locator("#income")).toContainText("stated defaults");
  await expect(page.locator("#ef")).toContainText("Target: 9 months");

  await page.goto("/confirm");
  await page.getByRole("button", { name: /Edit: Good and bad month income/ }).click();
  await next(page); // a good month: leave at the usual income
  await next(page); // a usual month
  await next(page); // a bad month: nothing at all
  await page.getByRole("link", { name: "Back to my results" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await showAllMetrics(page);
  await expect(page.locator("#income")).toContainText("Built from the good, usual and bad months you entered");
  await expect(page.locator("#income")).toContainText("Savings last about");
  // bad month of nothing: essentials 38,000 + EMIs 15,000 = 53,000 a month for 6 months = 3,18,000, against 38,000 of essentials = 8.4 months
  await expect(page.locator("#ef")).toContainText("Target: 8.4 months");
});

test("a missing key answer says 'Cannot calculate reliably' with low confidence, and no number", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Start Financial Health Check" }).first().click();
  await next(page); // income left at zero
  await next(page); // essentials left at zero
  await next(page); // savings
  await page.getByRole("button", { name: "No loans" }).first().click();
  await next(page); // dependents
  await page.getByRole("button", { name: "Skip" }).click(); // goals
  await page.getByRole("button", { name: "See my financial health" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByTestId("ladder-lead")).toContainText("Enter the missing answers first");
  await showAllMetrics(page);
  const cash = page.locator("#cash");
  await expect(cash.getByTestId("cannot-calculate")).toContainText("Cannot calculate reliably: Monthly income, Essential spending");
  await expect(cash.getByTestId("confidence")).toHaveAttribute("data-level", "low");
  await expect(page.getByTestId("data-quality")).toContainText("Monthly income was not entered");
  await expect(page.locator("#cash")).not.toContainText("₹0");
});

// ---------------------------------------------------------------------------------------------------------------
// Phase D: the suitability gate of the demo workflow
// ---------------------------------------------------------------------------------------------------------------
async function customerThenAdviser(browser: import("@playwright/test").Browser) {
  const customerCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 412, height: 860 }, locale: "en-IN" });
  const adviserCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 }, locale: "en-IN" });
  const customer = await customerCtx.newPage();
  const adviser = await adviserCtx.newPage();
  await customer.goto("/");
  await customer.getByRole("button", { name: "Got it" }).click();
  await customer.getByRole("button", { name: /Priya/ }).click();
  await customer.getByRole("button", { name: "Use demo answers" }).click();
  return { customer, adviser };
}

test("no case enters the queue without the questionnaire and the consent; the consent says it is not an e-signature", async ({ browser }) => {
  const { customer } = await customerThenAdviser(browser);
  await customer.getByRole("button", { name: "Get my plan reviewed" }).first().click();
  await customer.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(customer).toHaveURL(/\/agreement/);

  const cta = customer.getByRole("button", { name: "Agree (demo) and get my plan reviewed" });
  await expect(cta).toBeDisabled();
  await expect(customer.getByTestId("consent-text")).toContainText("No e-signature");
  await expect(customer.getByTestId("consent-text")).toContainText("Fee: ₹X/month");
  await expect(customer.getByTestId("consent-text")).toContainText("Conflicts:");
  await expect(customer.getByTestId("consent-text")).toContainText("synthetic");

  // six answers alone, or the consent alone, is not enough
  for (const q of ["cushion", "fall", "swing", "horizon", "years", "past"]) await customer.locator(`[data-testid="risk-q-${q}"] input[value="2"]`).check();
  await expect(cta).toBeDisabled();
  await expect(customer.getByTestId("risk-preview")).toContainText("Your profile for discussion");
  await customer.getByRole("checkbox", { name: /I have read this and I consent/ }).check();
  await expect(cta).toBeEnabled();
  await cta.click();
  await expect(customer).toHaveURL(/\/review-requested/);
  await customer.context().close();
});

test("approval needs every item decided and the risk profile confirmed; then the customer accepts, or reports an error", async ({ browser }) => {
  const { customer, adviser } = await customerThenAdviser(browser);
  await requestReview(customer);

  await adviser.goto("/");
  await adviser.getByRole("button", { name: "Got it" }).click();
  await adviser.getByRole("button", { name: /Adviser console/ }).click();
  await expect(adviser).toHaveURL(/\/adviser/);
  await openAdviserCase(adviser, "Priya");
  const reviewUrl = adviser.url();

  // the risk profile and the consent are in front of the adviser
  await expect(adviser.getByTestId("risk-category")).toBeVisible();
  await expect(adviser.getByTestId("risk-confirmation")).toContainText("Not confirmed yet");
  await expect(adviser.getByTestId("consent-line")).toContainText("Customer consent demo-1");

  // the checklist is its own page: every box can be ticked, yet Approve stays off until each plan item has a decision
  await adviser.goto(`${reviewUrl}/approve`);
  const approve = adviser.getByTestId("approve");
  const boxes = adviser.getByRole("checkbox");
  for (let i = 0; i < 7; i++) await boxes.nth(i).check();
  await expect(approve).toBeDisabled();
  await expect(adviser.getByText(/plan items still need your decision/)).toBeVisible();

  await adviser.goto(reviewUrl);
  await expect(adviser.getByTestId("risk-confirmation")).toContainText("Confirmed by");
  const pending = adviser.locator('li[data-decision="pending"]');
  expect(await pending.count()).toBeGreaterThan(1);
  await actOnEveryItem(adviser);
  // reject one so there is something to summarise
  await adviser.locator("li[data-decision]").first().getByRole("button", { name: "Reject", exact: true }).click();
  await continueToApproval(adviser);
  await expect(approve).toBeEnabled();
  await approve.click();
  await adviser.getByRole("dialog").getByRole("button", { name: "Approve (demo)" }).click();
  await expect(adviser.getByText("Approved in the demo workflow")).toBeVisible();

  // the customer: reviewed, but awaiting their acceptance
  await expect.poll(async () => { await openMyPlan(customer); return customer.url(); }, { timeout: 15_000 }).toMatch(/\/approved$/);
  await expect(customer.getByTestId("reviewed-title")).toHaveText("Your reviewed plan");
  await expect(customer.getByText("Reviewed, awaiting your acceptance")).toBeVisible();
  await expect(customer.getByTestId("plan-changes")).toContainText(/Changed 0 of \d+ items, removed 1\./);
  await customer.getByTestId("accept-plan").click();
  await expect(customer.getByTestId("accepted-note")).toBeVisible();

  // ... and can still report an error: the plan goes back to the adviser, flagged
  await customer.getByRole("button", { name: "Report an error in this plan" }).click();
  await customer.getByLabel("Report an error in this plan").last().fill("My rent is missing from essential costs.");
  await customer.getByRole("button", { name: "Send to the adviser" }).click();
  await expect(customer.getByText("Reported. The plan is back with an adviser, flagged.")).toBeVisible();
  await customer.keyboard.press("Escape");
  await expect(customer).toHaveURL(/\/advice\//, { timeout: 15_000 });
  await expect(customer.getByTestId("flagged-banner")).toBeVisible({ timeout: 10_000 });
  await expect(customer.getByTestId("draft-banner")).toBeVisible();

  await adviser.goto(reviewUrl);
  await expect(adviser.getByTestId("flagged-note")).toContainText("My rent is missing from essential costs.");
  // the audit page shows the plain-language change summary once it is reviewed again; here it is a fresh review
  await expect(adviser.getByTestId("risk-confirmation")).toContainText("Not confirmed yet");
  await customer.context().close();
  await adviser.context().close();
});

// ---------------------------------------------------------------------------------------------------------------
// Phase F: the plan is prepared in the background
// ---------------------------------------------------------------------------------------------------------------
// The e2e server runs in mock mode, where generation is instant. To see the progress states, the poll responses are
// rewritten as if a slow model were still working. (The real server behaviour is covered in tests/async-generation.test.ts.)
type Body = { case?: Record<string, unknown> | null };
/** The customer's case once the background preparation has finished (mock mode takes a moment under load). */
async function preparedCase(page: import("@playwright/test").Page) {
  await expect
    .poll(async () => page.evaluate(async () => (await (await fetch("/api/v1/sync")).json()).case?.status), { timeout: 15_000 })
    .toBe("DRAFT_READY");
  return page.evaluate(async () => (await (await fetch("/api/v1/sync")).json()).case);
}
async function stubCase(page: import("@playwright/test").Page, patchFor: (call: number, real: Record<string, unknown>) => Record<string, unknown> | null) {
  let call = 0;
  await page.route("**/api/v1/sync", async (route) => {
    try {
      const res = await route.fetch();
      const json = (await res.json()) as Body;
      const patched = json.case ? patchFor(call++, json.case) : null;
      await route.fulfill({ response: res, json: patched ? { ...json, case: patched } : json });
    } catch {
      // a poll still in flight when the test ends: the page is already closed
    }
  });
}

test("the findings appear first, then the plan; nothing is shown as an empty plan", async ({ page }) => {
  await startPriyaPlan(page);
  const real = await preparedCase(page);
  await stubCase(page, (call) => {
    const gen = { ...real.gen, startedAt: real.createdAt };
    const empty = { ...real.plan, items: [], priorities: [], summary: "" };
    if (call < 2) return { ...real, status: "INTAKE_DONE", plan: empty, gen: { ...gen, state: "generating", stage: "findings", findings: undefined } };
    if (call < 4) return { ...real, status: "INTAKE_DONE", plan: empty, gen: { ...gen, state: "generating", stage: "plan" } };
    return null; // the real, finished case
  });
  await page.reload();

  const panel = page.getByTestId("generating");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Preparing your findings")).toBeVisible();
  await expect(page.getByTestId("draft-banner")).toHaveCount(0); // no half-empty plan is shown
  // the findings are shown as soon as they are ready, while the plan is still being drafted
  await expect(page.getByTestId("findings-ready")).toBeVisible({ timeout: 10_000 });
  await expect(panel).toHaveAttribute("data-stage", "plan");
  await expect(panel.getByText("Drafting your plan")).toBeVisible();
  // then the plan itself
  await expect(page.getByTestId("draft-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("gen-took")).toContainText("Findings prepared in");
});

test("a failed preparation says so, keeps the answers and offers Try again", async ({ page }) => {
  await startPriyaPlan(page);
  const real = await preparedCase(page);
  await stubCase(page, () => ({ ...real, status: "INTAKE_DONE", plan: { ...real.plan, items: [], priorities: [], summary: "" }, gen: { ...real.gen, state: "failed", stage: "plan" } }));
  await page.reload();
  const alert = page.getByTestId("generation-failed");
  await expect(alert).toContainText("We could not prepare your plan this time");
  await expect(alert).toContainText("Nothing was lost");
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a plan that fell back to pre-written text is labelled, and can be retried before a reviewer starts", async ({ page }) => {
  await startPriyaPlan(page);
  const real = await preparedCase(page);
  await stubCase(page, () => ({ ...real, planSource: "fixture", gen: { ...real.gen, planSource: "fixture" } }));
  await page.reload();
  await expect(page.locator('[data-source="fixture"]').first()).toBeVisible();
  const retry = page.getByTestId("fallback-retry");
  await expect(retry).toContainText("did not pass the number and safety checks");
  await expect(retry.getByRole("button", { name: "Try the model again" })).toBeVisible();
});

test("Settings says exactly which of the last AI outputs were live, template or fallback", async ({ page }) => {
  await startPriyaPlan(page);
  await page.goto("/settings");
  const line = page.getByTestId("ai-status");
  await expect(line).toBeVisible();
  // mock mode, no key: nothing was live, and the line says how many were templates
  await expect(line).toHaveAttribute("data-live", "0");
  await expect(line).toHaveAttribute("data-fallback", "0");
  await expect(line).toContainText(/Last \d+ AI outputs on this server: 0 live, \d+ from templates, 0 fallback\./);
});

// ---------------------------------------------------------------------------------------------------------------
// Phase G: privacy notices, a visibly demo-only retention window, and the audit digest
// ---------------------------------------------------------------------------------------------------------------
test("the privacy notice sits above the Ask box and the demo retention window is stated as a demo policy", async ({ page }) => {
  await startPriyaPlan(page);
  await expect(page.getByTestId("ask-privacy")).toContainText("Do not type names, account numbers or ID numbers");
  await expect(page.getByTestId("ask-privacy")).toContainText("cannot be removed reliably");
  await page.goto("/check");
  await expect(page.getByText(/Do not paste or type names, account numbers or ID numbers/)).toBeVisible();
  await page.goto("/settings");
  const retention = page.getByTestId("retention-demo");
  await expect(retention).toContainText("24 hours");
  await expect(retention).toContainText("demo policy, not a record-retention schedule");
});

test("an adviser sees the audit digest, can export it once a day, and it says an export is not an anchor", async ({ page }) => {
  await page.request.post("/api/v1/auth/demo", { data: { persona: "adviser" }, headers: { "x-requested-with": "fetch", "content-type": "application/json" } });
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Got it" }).click().catch(() => undefined);
  const card = page.getByTestId("audit-digest");
  await expect(card).toContainText("export, not an anchor");
  await expect(page.getByTestId("digest-value")).toContainText(/Digest [0-9a-f]{64}/);
  await card.getByRole("button", { name: "Export today's digest" }).click();
  await expect(card.getByRole("status")).toContainText(/Saved as audit-digest-\d{4}-\d{2}-\d{2}\.json|already exists and was not overwritten/);
  await card.getByRole("button", { name: "Export today's digest" }).click();
  await expect(card.getByRole("status")).toContainText("already exists and was not overwritten");
  await expect(page.getByTestId("digest-last")).toContainText("matches the live chains");
});
