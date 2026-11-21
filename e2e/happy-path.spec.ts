import { expect, test, type Page } from "@playwright/test";
import { openMyPlan, openAdviserCase, continueToApproval, actOnEveryItem, resetDemo, requestReview, showAllMetrics } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

// One end-to-end happy path in mock mode: Second Opinion -> Priya intake -> plan -> adviser approval
// -> REVIEWED (DEMO) -> panic-sell guardrail -> clear demo data.
const approveFlow = async (page: Page) => {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Adviser view (demo)" }).click();
  await expect(page).toHaveURL(/\/adviser/);
  await expect(page.getByText("Approvals here simulate a review process and are not regulated investment advice.").first()).toBeVisible();
  await openAdviserCase(page, "Priya");
  await expect(page.getByTestId("draft-watermark")).toBeVisible(); // the adviser sees the draft mark too
  await expect(page.getByTestId("continue-approval")).toHaveAttribute("aria-disabled", "true");
  // edit the first item: the original AI text stays beside the edit, and a reason is required
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByLabel("Edit the rationale").fill("A calmer rationale: build the reserve step by step, in liquid low-risk options, for discussion.");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByLabel("Reason for change (required)").fill("A staged target fits a steady income.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("ORIGINAL AI DRAFT").first()).toBeVisible();
  // every plan item needs a decision before approval is possible (the edited one has one already)
  await actOnEveryItem(page);
  await continueToApproval(page);
  // checklist: all seven, including the demo acknowledgement
  const approve = page.getByTestId("approve");
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(7);
  await expect(approve).toBeDisabled();
  for (let i = 0; i < 6; i++) await boxes.nth(i).check();
  await expect(approve).toBeDisabled(); // the demo acknowledgement is still unticked
  await boxes.nth(6).check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole("dialog").getByText("Demo workflow. Approvals here simulate a review process")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Approve (demo)" }).click();
  await expect(page).toHaveURL(/\/adviser\/case\/[^/]+\/audit$/);
  await expect(page.getByText("Approved in the demo workflow")).toBeVisible();
};

test("Priya: landing to REVIEWED (DEMO), guardrail, and clear data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();

  // 1. Second Opinion without an account
  await page.getByRole("link", { name: "Explore Second Opinion" }).first().click();
  await expect(page).toHaveURL(/\/second-opinion$/);
  await page.getByRole("button", { name: "3% every month" }).click();
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page).toHaveURL(/\/second-opinion\/result$/);
  await expect(page.getByText("High risk: strong indicators")).toBeVisible();
  await expect(page.getByText(/42\.6%/).first()).toBeVisible();
  await expect(page.getByText("EDUCATION").first()).toBeVisible();

  // 2. Priya, Tamil UI, quick intake
  await page.goto("/");
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.locator("header").getByRole("button", { name: "தமிழ்" }).click();
  await expect(page.locator("main h2").first()).toHaveText(/[஀-௿]/); // the question is in Tamil now
  await page.locator("header").getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();

  // 3. Dashboard from the engine: 1.8 months
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("1.8 months").first()).toBeVisible();
  await showAllMetrics(page);
  await page.locator("#ef").getByRole("button", { name: "How was this calculated?" }).click();
  await expect(page.getByRole("dialog").getByText("liquidSavings / essentialMonthlyExpenses")).toBeVisible();
  await page.keyboard.press("Escape");

  // 4. Plan draft
  await requestReview(page);
  await openMyPlan(page);
  await expect(page.getByText("AI DRAFT · NOT APPROVED ADVICE")).toBeVisible();
  await expect(page.getByText("Do not act on this yet.")).toBeVisible();
  await expect(page.getByTestId("draft-watermark")).toBeVisible();

  // 5. Adviser approves in the demo workflow
  await approveFlow(page);

  // 6. Back to the user: green REVIEWED (DEMO), synthetic adviser card, audit diff
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Customer view (demo)" }).click();
  await openMyPlan(page);
  await expect(page).toHaveURL(/\/approved$/);
  await expect(page.getByText("REVIEWED (DEMO)").first()).toBeVisible();
  await expect(page.getByTestId("draft-watermark")).toHaveCount(0); // approved: the draft mark is gone
  await expect(page.getByText("Reviewed in a demo workflow by a synthetic adviser persona. Not real investment advice.").first()).toBeVisible();
  await expect(page.getByText("Synthetic adviser - demo persona; not a real SEBI-registered adviser.")).toBeVisible();
  await expect(page.getByText("No registration (demo persona)")).toBeVisible();
  await expect(page.getByText(/\bIN[AHP]\d/)).toHaveCount(0);
  await page.goto("/activity");
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByRole("heading", { name: "Compare versions" })).toBeVisible();
  await expect(page.locator("ins").first()).toBeVisible();

  // 7. A forced stock-tip question is refused and audit-logged as `system`
  await openMyPlan(page);
  await page.getByLabel("Ask about your numbers…").fill("Which stock should I buy?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/can't suggest specific stocks/)).toBeVisible();
  await page.goto("/activity");
  await expect(page.getByText("Stock-tip request declined")).toBeVisible();

  // 8. Market-fall guardrail: a calm page with a pause and a way to a person, and no way to sell
  await page.goto("/fall");
  await expect(page).toHaveURL(/\/guardrail\/market-fall/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Take a breath.");
  await expect(page.getByRole("button", { name: /sell/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Start a 5-minute pause" }).click();
  await expect(page.getByText(/left\. Nothing is asked of you/)).toBeVisible();
  await page.getByRole("button", { name: "End the pause" }).click();
  await page.getByRole("button", { name: "Request a conversation" }).click();
  await expect(page.getByText(/Priority case created/).first()).toBeVisible();

  // 9. Data retention: session storage holds data, then Clear demo data removes every namespaced key
  const keys = () => page.evaluate(() => Object.keys(sessionStorage).concat(Object.keys(localStorage)).filter((k) => k.startsWith("fsdemo:v1:")));
  expect((await keys()).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.endsWith(":state")))).toEqual([]);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Clear demo data" }).click();
  await page.getByRole("button", { name: "Clear now" }).click();
  await expect.poll(keys).toEqual([]);
});
