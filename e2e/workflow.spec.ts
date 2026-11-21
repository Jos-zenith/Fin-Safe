import { expect, test } from "@playwright/test";
import { openAdviserCase, continueToApproval, openMyPlan, actOnEveryItem, resetDemo, startPriyaPlan } from "./helpers";

// Two separate browsers (two cookie jars), one customer and one adviser. Nothing here reloads a page: every
// change must arrive through the 1-second poll that the test server is started with (the default is 5 seconds).
test.beforeEach(async ({ request }) => resetDemo(request));

const BASE = "http://localhost:3100";

test("customer and adviser in two browsers: claim, a returned question, a reply and an approval all arrive live", async ({ browser }) => {
  const adviserCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 860 }, locale: "en-IN" });
  const customerCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 412, height: 860 }, locale: "en-IN" });
  const adviser = await adviserCtx.newPage();
  const customer = await customerCtx.newPage();

  // --- the adviser signs in first and sees the two seeded waiting cases, the older one overdue ---
  await adviser.goto("/");
  await adviser.getByRole("button", { name: "Got it" }).click();
  await adviser.getByRole("button", { name: /Adviser console/ }).click();
  await expect(adviser).toHaveURL(/\/adviser/);
  await expect(adviser.getByTestId("row-case-ramesh")).toBeVisible();
  await expect(adviser.getByTestId("row-case-anita")).toBeVisible();
  await expect(adviser.getByTestId("sla-case-ramesh")).toContainText(/needs attention/); // the older one is past the demo SLA
  await expect(adviser.getByTestId("sla-case-anita")).not.toContainText(/needs attention/);
  await expect(adviser.getByTestId("demo-auth")).toHaveText("Demo authentication. Not secure authentication.");

  // --- the customer asks for a review; the adviser's badge and queue update by themselves ---
  await startPriyaPlan(customer);
  await customer.getByRole("link", { name: "View case status" }).first().click();
  await expect(customer).toHaveURL(/\/case\/case-priya$/);
  await expect(customer.getByText("Waiting for review").first()).toBeVisible();
  await expect(adviser.getByTestId("unread-badge")).toBeVisible({ timeout: 10_000 });
  await expect(adviser.getByTestId("row-case-priya")).toBeVisible({ timeout: 10_000 });

  // a customer cannot approve, by any route
  const forbidden = await customerCtx.request.post("/api/v1/cases/case-priya/approve", { data: {}, headers: { "x-requested-with": "fetch", "content-type": "application/json" } });
  expect(forbidden.status()).toBe(403);
  const claimByCustomer = await customerCtx.request.post("/api/v1/cases/case-priya/claim", { data: {}, headers: { "x-requested-with": "fetch", "content-type": "application/json" } });
  expect(claimByCustomer.status()).toBe(403);

  // --- the adviser opens the case (which claims it); the customer sees "being reviewed" without reloading ---
  await openAdviserCase(adviser, "Priya");
  const reviewUrl = adviser.url();
  await expect(adviser.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
  // the adviser copilot is AI-prepared text and says so
  await adviser.goto(`${reviewUrl}/copilot`);
  await expect(adviser.getByText(/Template \(mock\): pre-written wording/).first()).toBeVisible({ timeout: 10_000 });
  await adviser.goto(reviewUrl);
  await expect(customer.getByText("Being reviewed").first()).toBeVisible({ timeout: 10_000 });
  await expect(customer.getByTestId("unread-badge")).toBeVisible({ timeout: 10_000 });

  // --- the adviser returns a question; it appears on the customer's screen ---
  await adviser.getByRole("button", { name: "Return for changes" }).first().click();
  await adviser.getByLabel("What do you need to know?").fill("Is your monthly rent included in essential expenses?");
  await adviser.getByRole("button", { name: "Send question" }).click();
  await expect(customer.getByText("Is your monthly rent included in essential expenses?")).toBeVisible({ timeout: 10_000 });
  await customer.getByTestId("notif-bell").click();
  await expect(customer.getByTestId("notif-list")).toContainText("Is your monthly rent included in essential expenses?");
  await customer.getByRole("button", { name: "Mark all as read" }).click();
  await expect(customer.getByTestId("unread-badge")).toHaveCount(0);
  await customer.keyboard.press("Escape");

  // --- the customer replies; the adviser is notified and the case is back in their queue ---
  await customer.getByLabel("Type your reply").fill("Yes, rent is included.");
  await customer.getByRole("button", { name: "Send" }).click();
  await adviser.getByTestId("notif-bell").click();
  await expect(adviser.getByTestId("notif-list")).toContainText(/replied to your question/, { timeout: 10_000 });
  await adviser.keyboard.press("Escape");

  // --- the adviser takes it again, ticks the checklist (including the assumptions review) and approves ---
  await adviser.goto("/adviser");
  await openAdviserCase(adviser, "Priya");
  await adviser.goto(`${reviewUrl}/approve`);
  const approve = adviser.getByTestId("approve");
  await expect(approve).toBeDisabled();
  // ticking the whole checklist is not enough: every plan item needs a decision too
  const boxes = adviser.getByRole("checkbox");
  await expect(boxes).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    await boxes.nth(i).check();
    // the server records each tick; an incomplete checklist can never approve
    await expect(approve).toBeDisabled();
  }
  await expect(adviser.getByText(/plan items still need your decision/)).toBeVisible();
  await adviser.goto(reviewUrl);
  await actOnEveryItem(adviser);
  await continueToApproval(adviser);
  await expect(approve).toBeEnabled();
  await approve.click();
  await adviser.getByRole("dialog").getByRole("button", { name: "Approve (demo)" }).click();
  await expect(adviser.getByText("Approved in the demo workflow")).toBeVisible();
  await expect(adviser.getByTestId("chain-status").first()).toContainText(/Audit chain verified/);

  // --- the customer's open page flips to REVIEWED (DEMO) by itself, with a notification ---
  await expect(customer.getByText("Reviewed (demo)").first()).toBeVisible({ timeout: 10_000 });
  await expect(customer.getByTestId("unread-badge")).toBeVisible();
  await customer.getByTestId("notif-bell").click();
  await expect(customer.getByTestId("notif-list")).toContainText(/reviewed in the demo workflow/);
  await customer.keyboard.press("Escape");

  // --- the customer's Activity page shows the hash-chained audit as verified ---
  await customer.goto("/activity");
  await expect(customer.getByTestId("chain-status")).toContainText(/Audit chain verified/);
  await expect(customer.getByText("Approved in demo workflow")).toBeVisible();

  await adviserCtx.close();
  await customerCtx.close();
});

test("one customer cannot read another's case, even by guessing its id", async ({ browser }) => {
  const a = await browser.newContext({ baseURL: BASE });
  const b = await browser.newContext({ baseURL: BASE });
  const H = { "x-requested-with": "fetch", "content-type": "application/json" };
  await a.request.post("/api/v1/auth/demo", { data: { persona: "ramesh" }, headers: H });
  await b.request.post("/api/v1/auth/demo", { data: { persona: "anita" }, headers: H });
  expect((await a.request.get("/api/v1/cases/case-ramesh")).status()).toBe(200);
  expect((await a.request.get("/api/v1/cases/case-anita")).status()).toBe(404);
  expect((await b.request.get("/api/v1/cases/case-ramesh")).status()).toBe(404);
  expect((await a.request.get("/api/v1/cases")).status()).toBe(403); // the queue is the adviser's
  expect((await browser.newContext({ baseURL: BASE }).then((c) => c.request.get("/api/v1/cases/case-ramesh"))).status()).toBe(401);
  await a.close();
  await b.close();
});

test("an adviser can mark an assumption reviewed; the count of unverified assumptions drops for everyone", async ({ browser }) => {
  const adviserCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 860 } });
  const guestCtx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 860 } });
  const adviser = await adviserCtx.newPage();
  const guest = await guestCtx.newPage();
  await adviser.goto("/");
  await adviser.getByRole("button", { name: "Got it" }).click();
  await adviser.getByRole("button", { name: /Adviser console/ }).click();
  await adviser.goto("/assumptions");
  await expect(adviser.getByTestId("assump-adviser-note")).toBeVisible();
  const before = await adviser.getByTestId("assump-summary").innerText();
  await adviser.getByRole("button", { name: "Mark as reviewed (demo)" }).first().click();
  await expect(adviser.getByTestId("assump-summary")).not.toHaveText(before);

  // a visitor with no session sees the same list, with no adviser controls, and the reviewed entry shown as reviewed
  await guest.goto("/assumptions");
  await expect(guest.getByTestId("assump-adviser-note")).toHaveCount(0);
  await expect(guest.getByRole("button", { name: "Mark as reviewed (demo)" })).toHaveCount(0);
  await expect(guest.getByTestId("assump-summary")).not.toHaveText(before);
  await adviserCtx.close();
  await guestCtx.close();
});

test("Metrics: adviser-only, labelled as demo data, with an editable illustrative calculator", async ({ page, browser }) => {
  // a customer sees only the gate
  const guest = await browser.newContext({ baseURL: BASE });
  const gp = await guest.newPage();
  await gp.goto("/metrics");
  await gp.getByRole("button", { name: "Got it" }).click();
  await expect(gp.getByText("This page is for the demo adviser.")).toBeVisible();
  await expect(gp.getByTestId("metrics-grid")).toHaveCount(0);
  expect((await guest.request.get("/api/v1/metrics")).status()).toBe(401);
  await guest.close();

  await page.request.post("/api/v1/auth/demo", { data: { persona: "adviser" }, headers: { "x-requested-with": "fetch", "content-type": "application/json" } });
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByTestId("metrics-banner")).toHaveText("Demo data. Not evidence.");
  await expect(page.getByTestId("metrics-grid")).toBeVisible();
  // no live model here, so no flattering 0% rejection rate
  await expect(page.getByTestId("no-live")).toContainText("No live model has been used");
  await expect(page.getByText("Too few to mean anything.").first()).toBeVisible();

  const ue = page.getByTestId("unit-economics");
  await expect(ue).toContainText("made-up defaults, not data and not a forecast");
  const before = await ue.getByTestId("ue.o.costPlan").innerText();
  await ue.getByLabel("Minutes to review one draft").fill("45");
  await expect(ue.getByTestId("ue.o.costPlan")).not.toHaveText(before);
  await ue.getByRole("button", { name: "Reset to the made-up defaults" }).click();
  await expect(ue.getByTestId("ue.o.costPlan")).toHaveText(before);
});
