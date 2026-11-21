import { expect, test } from "@playwright/test";
import { openMyPlan, resetDemo, showAllMetrics, startPriyaPlan } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("a Tamil scam tip is rated HIGH, with the engine's yearly figure, in Tamil", async ({ page }) => {
  await page.goto("/check");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.locator("header").getByRole("button", { name: "தமிழ்" }).click();
  await page.locator("textarea").fill("இந்த பங்கை வாங்குங்கள், மாதம் 10% உத்தரவாத லாபம், இன்றே பணம் போடுங்கள்");
  await page.getByRole("button", { name: "செய்தியை ஆராய்" }).click();
  await expect(page.getByText("அதிக ஆபத்து: வலுவான அறிகுறிகள்")).toBeVisible();
  await expect(page.getByText(/213\.8%/).first()).toBeVisible(); // (1.10^12 - 1) x 100, from the engine
  await expect(page.locator("mark").first()).toBeVisible();
});

test("Ask a question listens: answers from your numbers, refuses stock tips and market predictions", async ({ page }) => {
  await startPriyaPlan(page);

  await page.getByRole("button", { name: "Why is my score low?" }).click();
  await expect(page.getByText(/Your score is \d+/)).toBeVisible();

  await page.getByRole("button", { name: "What is a SIP?" }).click();
  await expect(page.getByText(/fixed amount on a fixed date/)).toBeVisible();

  await page.getByRole("button", { name: "Which stock should I buy?" }).click();
  await expect(page.getByText("Not something I can answer").first()).toBeVisible();

  const box = page.getByLabel("Ask about your numbers…");
  for (const [q, expected] of [
    ["nifty will hit 30000?", /can't predict/],
    ["Is HDFC bank a good investment?", /can't suggest specific stocks/],
    ["bitcoin or gold", /can't suggest specific stocks/],
  ] as const) {
    await box.fill(q);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(expected).last()).toBeVisible();
  }

  // a real, answerable question is NOT refused and is not the old canned reply
  await box.fill("Should I buy a house?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/big life choice/)).toBeVisible();
  await expect(page.getByText(/^Good question/)).toHaveCount(0);

  // every refusal is audit-logged as a system entry
  await page.goto("/activity");
  await expect(page.getByText("Stock-tip request declined").first()).toBeVisible();
});

test("the plan says where its text came from, and no label is shown twice", async ({ page }) => {
  await startPriyaPlan(page);
  await expect(page.getByText(/Template \(mock\): pre-written wording filled with your numbers/).first()).toBeVisible();
  // the dashboard's findings carry their source in the first view already; the nudges (behind "See all metrics") carry theirs too
  await page.goto("/home");
  const source = page.getByText(/Template \(mock\): pre-written wording filled with your numbers/);
  await showAllMetrics(page);
  await expect.poll(() => source.count()).toBeGreaterThanOrEqual(1); // the AI-written findings carry theirs
  await page.goBack();
  // every AI-prepared output explains itself on demand
  await page.getByText("How was this made?").first().click();
  await expect(page.getByText(/No AI model was used/).first()).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/Range for discussion:\s*Range for discussion/);
  expect(body).not.toMatch(/For discussion:\s*For discussion/);
});

test("goal explorer: the slider changes the outcome range, and waiting a year costs more", async ({ page }) => {
  await startPriyaPlan(page);
  const slider = page.getByRole("slider");
  await slider.scrollIntoViewIfNeeded();
  await expect(page.getByText(/At this amount the base case reaches your goal\./)).toBeVisible();

  await slider.fill("0");
  await expect(page.getByText(/falls short by ₹12,02,\d{3}/)).toBeVisible(); // 8,00,000 in today's money, raised for inflation
  await expect(page.getByText(/you may have ₹0 to ₹0/)).toBeVisible();
  await expect(page.getByText(/Taxes are not included/).first()).toBeVisible();

  await slider.fill("5000");
  await expect(page.getByText(/falls short by/)).toBeVisible();

  await page.getByText("Show what happens if I start a year later").click();
  await expect(page.getByText(/waiting a year adds about ₹[\d,]+ to the monthly amount/)).toBeVisible();

  await page.getByRole("button", { name: "How was this calculated?" }).last().click();
  await expect(page.getByRole("dialog").getByText(/never a promise/).first()).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Taxes are not included/).first()).toBeVisible();
});

test("Second Opinion shows what it could not check, never calls a message safe, and can report a miss", async ({ page }) => {
  await page.goto("/check");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "SIP explained" }).click();
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page).toHaveURL(/\/second-opinion\/result$/);

  await expect(page.getByTestId("check-found")).toHaveText("No known warning signs were found in this check");
  await expect(page.getByText("That does not mean the message is safe.").first()).toBeVisible();
  await expect(page.getByTestId("check-limits")).toContainText("What this check could not do");
  await expect(page.getByText("It did not open or visit any link.")).toBeVisible();
  await expect(page.getByText("It could not verify who sent the message.")).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body.replaceAll("That does not mean the message is safe.", "")).not.toMatch(/\b(?:is|looks|seems) (?:safe|legit|genuine)\b/i);

  await page.getByRole("button", { name: "Report a missed scam" }).click();
  await expect(page.getByText(/Saved to the review list on this device/)).toBeVisible();
});

test("Second Opinion inspects a link offline and hides personal details first", async ({ page }) => {
  await page.goto("/check");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.locator("textarea").fill("Dear Priya Sharma, your KYC is pending. Update now: http://sunrise-kyc-update.top/verify?id=88213 or pay ravi.k87@oksunrise");
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page.getByTestId("check-links")).toContainText("Several warning patterns");
  await expect(page.getByTestId("check-links")).toContainText("verify?[query]");
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/88213|ravi\.k87|Priya Sharma/);
});

test("Action center: steps per finding, snooze with a date, undo, and a before/after when savings are updated", async ({ page }) => {
  await startPriyaPlan(page);
  await page.goto("/improve");
  await expect(page).toHaveURL(/\/actions$/);
  await expect(page.getByTestId("draft-watermark")).toBeVisible(); // not reviewed yet: the draft mark, and the chip says so
  await expect(page.getByText("DRAFT · not yet reviewed").first()).toBeVisible();

  // a planning to-do written from the engine's figures (1.8 months), not a product instruction
  const ef = page.getByTestId("action-ef_low");
  await expect(ef).toContainText(/You have 1\.8 months/);
  await expect(ef).not.toContainText(/\b(buy|sell|stock|mutual fund|index fund|ETF)\b/i);
  await expect(ef).toContainText("Why you are seeing this");

  // snooze for a week: it moves to the Snoozed tab with a return date, and Undo puts it back
  await ef.getByRole("button", { name: /Snooze/ }).click();
  await ef.getByRole("button", { name: "In 1 week" }).click();
  await expect(page.getByText(/Snoozed until/)).toBeVisible();
  await expect(page.getByTestId("action-ef_low")).toHaveCount(0); // gone from the Open tab
  await page.getByTestId("tab-snoozed").click();
  await expect(page.getByTestId("action-ef_low").getByTestId("action-status")).toContainText(/Returns \d{2}\/\d{2}\/\d{4}/);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByTestId("tab-open").click();
  await expect(page.getByTestId("action-ef_low")).toBeVisible();

  // mark complete, then it is on the Done tab
  await page.getByTestId("action-ef_low").getByRole("button", { name: "Mark complete" }).click();
  await page.getByTestId("tab-done").click();
  await expect(page.getByTestId("action-ef_low")).toBeVisible();
  await page.getByTestId("tab-open").click();

  // update savings: the engine runs again, and the before and after are shown
  await page.getByRole("heading", { name: "Update your numbers" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Emergency savings" }).click();
  for (const d of "1500000") await page.getByRole("dialog").getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue", exact: true }).click();
  const ba = page.getByTestId("before-after");
  await expect(ba).toContainText("Emergency fund (months)");
  await expect(ba).toContainText("1.8");
  // the finding that no longer applies is shown as resolved by the update
  await expect(page.getByTestId("resolved-actions")).toContainText(/No longer flagged after your update/);
  // and reminders live inside the app only
  await expect(page.getByText(/Nothing is sent by email, SMS or WhatsApp/)).toBeVisible();
});
