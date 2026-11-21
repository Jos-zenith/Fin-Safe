import { expect, test, type Page } from "@playwright/test";
import { openMyPlan, resetDemo, requestReview } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

const seed = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.getByRole("button", { name: "Use demo answers" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
};

const noSideScroll = async (page: Page, where: string) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(o.sw, `${where}: horizontal scroll (${o.sw} > ${o.iw})`).toBeLessThanOrEqual(o.iw + 1);
};

test.describe("laptop / projector (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("landing is a two-column desktop page, not a phone column", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Got it" }).click();
    const hero = await page.getByRole("heading", { name: /Guidance an adviser can review in minutes/ }).boundingBox();
    const lanes = await page.getByText("Three separate things").boundingBox();
    expect(hero && lanes).toBeTruthy();
    expect(lanes!.x - hero!.x).toBeGreaterThan(450); // side by side
    await noSideScroll(page, "landing");
  });

  test("navigation becomes top tabs; the phone bottom bar is hidden", async ({ page }) => {
    await seed(page);
    const plan = page.getByRole("link", { name: "Plan", exact: true });
    await expect(plan).toBeVisible();
    const box = await plan.boundingBox();
    expect(box!.y).toBeLessThan(200); // under the header, not at the bottom
    await expect(page.getByRole("link", { name: "Plan", exact: true })).toHaveCount(1);
  });

  test("home uses three columns, plan uses a side panel with a card grid", async ({ page }) => {
    await seed(page);
    await requestReview(page);
    await expect(page).toHaveURL(/\/plan/);
    const aside = await page.locator("aside").boundingBox();
    const first = await page.getByRole("heading", { name: /Build your emergency reserve/ }).boundingBox();
    expect(first!.x).toBeGreaterThan(aside!.x + aside!.width - 5); // main column sits beside the panel
    const second = await page.getByRole("heading", { name: /Check your health cover/ }).boundingBox();
    expect(second!.x).toBeGreaterThan(first!.x + 200); // two cards per row
    await noSideScroll(page, "plan");
  });

  for (const path of ["/home", "/plan", "/check", "/learn", "/activity", "/settings", "/fall", "/adviser"]) {
    test(`no horizontal scroll at 1280px on ${path}`, async ({ page }) => {
      await seed(page);
      await page.goto(path);
      await page.waitForTimeout(300);
      await noSideScroll(page, path);
    });
  }
});

test.describe("small phone (360px)", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const path of ["/", "/home", "/plan", "/check", "/learn", "/activity", "/settings", "/fall", "/adviser", "/intake"]) {
    test(`no horizontal scroll at 360px on ${path}`, async ({ page }) => {
      await seed(page);
      await page.goto(path);
      await page.waitForTimeout(300);
      await noSideScroll(page, path);
    });
  }
});
