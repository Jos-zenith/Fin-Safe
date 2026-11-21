import { expect, test } from "@playwright/test";
import { openMyPlan, actOnEveryItem, resetDemo, startPriyaPlan } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

const H = { "x-requested-with": "fetch", "content-type": "application/json" };

test("security headers are sent on pages and on the API", async ({ request }) => {
  for (const url of ["/", "/home", "/api/v1/health"]) {
    const r = await request.get(url);
    const h = r.headers();
    expect(h["content-security-policy"], url).toMatch(/default-src 'self'/);
    expect(h["content-security-policy"], url).toMatch(/frame-ancestors 'none'/);
    expect(h["content-security-policy"], url).not.toMatch(/unsafe-eval/); // production build
    expect(h["x-frame-options"], url).toBe("DENY");
    expect(h["x-content-type-options"], url).toBe("nosniff");
    expect(h["referrer-policy"], url).toBe("no-referrer");
    expect(h["permissions-policy"], url).toMatch(/microphone=\(self\)/);
    expect(h["x-powered-by"], url).toBeUndefined();
  }
  // the session cookie is httpOnly + same-site, and an API answer is never cached
  const s = await request.post("/api/v1/auth/demo", { data: { persona: "priya" }, headers: H });
  expect(s.headers()["set-cookie"]).toMatch(/HttpOnly/);
  expect(s.headers()["set-cookie"]).toMatch(/SameSite=Lax/);
  expect(s.headers()["cache-control"]).toMatch(/no-store/);
});

test("the CSP breaks nothing: the whole demo runs with no violation reported", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|violates the following/i.test(m.text())) violations.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (/Content Security Policy/i.test(e.message)) violations.push(e.message);
  });
  await startPriyaPlan(page);
  await page.goto("/actions");
  await page.goto("/second-opinion");
  await page.getByRole("button", { name: "3% every month" }).click();
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page.getByTestId("check-found")).toBeVisible();
  await page.goto("/assumptions");
  expect(violations).toEqual([]);
});

test("the notification bell and its sheet work from the keyboard, and focus stays inside the sheet", async ({ page }) => {
  await startPriyaPlan(page);
  const bell = page.getByTestId("notif-bell");
  await expect(bell).toHaveAccessibleName(/Notifications/);
  // reach it the way a keyboard user does: by tabbing from the top of the page
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await bell.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(bell).toBeFocused();
  // a visible focus indicator
  const ring = await bell.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== "none" || s.boxShadow !== "none";
  });
  expect(ring, "visible focus indicator").toBe(true);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // a modal dialog makes the page behind it inert: tabbing many times never lands on anything outside it
  // (focus may pass through the browser's own controls, where the page reports <body>)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const outside = await page.evaluate(() => {
      const el = document.activeElement;
      return !!el && el !== document.body && !el.closest("dialog");
    });
    expect(outside, "focus escaped the dialog").toBe(false);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("the adviser console works without a mouse: open a case, decide every item, tick the checklist, reach Approve, and back out", async ({ page }) => {
  await page.request.post("/api/v1/auth/demo", { data: { persona: "adviser" }, headers: H });
  await page.goto("/adviser");
  await page.getByRole("button", { name: "Got it" }).click();
  const open = page.locator("tr:visible, li:visible").filter({ hasText: "Anita" }).getByRole("link", { name: "Open" }).first();
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anita");
  await expect(page.getByTestId("continue-approval")).toHaveAttribute("aria-disabled", "true");
  await actOnEveryItem(page, true); // with the keyboard: focus Accept, press Enter
  const next = page.getByTestId("continue-approval");
  await expect(next).not.toHaveAttribute("aria-disabled", "true");
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/approve$/);
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(7);
  const approve = page.getByTestId("approve");
  await expect(approve).toBeDisabled();
  for (let i = 0; i < 7; i++) {
    await boxes.nth(i).focus();
    await page.keyboard.press("Space");
    await expect(boxes.nth(i)).toBeChecked();
  }
  await expect(approve).toBeEnabled();
  await approve.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  // nothing was approved by backing out
  await expect(page.getByText("Approved in the demo workflow")).toHaveCount(0);
});
