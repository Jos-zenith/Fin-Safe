import { expect, test } from "@playwright/test";

// What a visitor, a search engine or a link preview gets BEFORE any JavaScript runs, and how the loading and dialog
// structure behaves for screen readers. These read the raw HTML the server sends.

test("the landing page's first HTML says what the product is, with link-preview tags and a no-JavaScript note", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/<h1[^>]*>Guidance an adviser can review in minutes/);
  expect(html).toContain("Try it with your own numbers");
  expect(html).toContain('property="og:title"');
  expect(html).toContain('property="og:description"');
  expect(html).toContain('property="og:image"');
  expect(html).toContain("<noscript>");
  expect(html).not.toContain('aria-busy="true"'); // no empty busy region
});

test("the link-preview image exists and is a PNG", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const src = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
  expect(src).toBeTruthy();
  const res = await request.get(new URL(src!).pathname);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("a page that waits for saved state announces 'Loading' instead of an empty busy region", async ({ request }) => {
  const html = await (await request.get("/home")).text();
  expect(html).toMatch(/role="status"[^>]*>\s*<p class="sr-only">Loading/);
  expect(html).not.toContain('aria-busy="true"');
});

test("closed dialogs are not in the page: none in the first HTML, one only while a sheet is open", async ({ page, request }) => {
  expect(await (await request.get("/")).text()).not.toContain("<dialog");
  await page.goto("/");
  await expect(page.locator("dialog")).toHaveCount(1); // the first-visit demo notice
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu" })).toBeFocused(); // focus goes back to what opened it
});

test("only Inter is requested at first; the Hindi font arrives, with matching weights, when Hindi is chosen", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("family=Inter:wght@400;500;600;700");
  expect(html).not.toContain("Noto+Sans");

  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator('link[href*="Noto+Sans"]')).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "हिन्दी" }).click();
  const hi = page.locator('link[href*="Noto+Sans+Devanagari"]');
  await expect(hi).toHaveCount(1);
  await expect(hi).toHaveAttribute("href", /wght@400;500;600;700/);
  await expect(page.locator('link[href*="Noto+Sans+Tamil"]')).toHaveCount(0);
});

test("the role switch is in the menu, not a header control, and the demo notice stays visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("group", { name: /Switch role/ })).toHaveCount(0);
  await expect(page.locator("header span:visible", { hasText: "Demo: synthetic data" })).toHaveCount(1); // one pill is shown per screen size
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Adviser view (demo)" })).toBeVisible();
});

test("the sign-in notice shows where sign-in happens (landing, adviser, settings) and not on every page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByTestId("demo-auth")).toHaveText("Demo authentication. Not secure authentication.");
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("demo-auth")).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByTestId("demo-auth")).toBeVisible();
});
