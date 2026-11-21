// The 25 approved routes (wireframes2/project, "Information architecture") all exist as their own pages, navigation rules
// are consistent, and the product is called ArthClear.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/config/brand";
import { adviserActive, adviserFocusCase, caseRef, customerActive, hasOwnBanner, headerVariant, planHref, showsRichFooter } from "@/lib/nav";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

// route -> the file that implements it (a dynamic segment is a [folder])
const ROUTES: [string, string][] = [
  ["/", "src/app/page.tsx"],
  ["/intake", "src/app/intake/page.tsx"],
  ["/dashboard", "src/app/dashboard/page.tsx"],
  ["/advice/:caseId", "src/app/advice/[caseId]/page.tsx"],
  ["/case/:caseId", "src/app/case/[caseId]/page.tsx"],
  ["/case/:caseId/review-requested", "src/app/case/[caseId]/review-requested/page.tsx"],
  ["/case/:caseId/approved", "src/app/case/[caseId]/approved/page.tsx"],
  ["/case/:caseId/audit", "src/app/case/[caseId]/audit/page.tsx"],
  ["/second-opinion", "src/app/second-opinion/page.tsx"],
  ["/second-opinion/result", "src/app/second-opinion/result/page.tsx"],
  ["/guardrail/market-fall", "src/app/guardrail/market-fall/page.tsx"],
  ["/actions", "src/app/actions/page.tsx"],
  ["/transparency", "src/app/transparency/page.tsx"],
  ["/learn", "src/app/learn/page.tsx"],
  ["/settings", "src/app/settings/page.tsx"],
  ["/adviser", "src/app/adviser/page.tsx"],
  ["/adviser/case/:caseId", "src/app/adviser/case/[caseId]/page.tsx"],
  ["/adviser/case/:caseId/copilot", "src/app/adviser/case/[caseId]/copilot/page.tsx"],
  ["/adviser/case/:caseId/approve", "src/app/adviser/case/[caseId]/approve/page.tsx"],
  ["/adviser/case/:caseId/audit", "src/app/adviser/case/[caseId]/audit/page.tsx"],
  ["/about", "src/app/about/page.tsx"],
  ["/compliance", "src/app/compliance/page.tsx"],
  ["/sources", "src/app/sources/page.tsx"],
  ["/help", "src/app/help/page.tsx"],
  ["/*", "src/app/not-found.tsx"],
];

describe("the 25 routes", () => {
  it("lists exactly 25", () => expect(ROUTES).toHaveLength(25));
  for (const [route, file] of ROUTES) {
    it(`${route} has its own page (${file})`, () => {
      expect(existsSync(path.join(root, file))).toBe(true);
      const src = read(file);
      expect(src).toContain("export default");
      // a real implementation, not a placeholder
      expect(src.length).toBeGreaterThan(900);
      expect(src).not.toMatch(/TODO|lorem ipsum|placeholder page/);
    });
  }

  it("no two routes render the same file", () => expect(new Set(ROUTES.map((r) => r[1])).size).toBe(25));

  it("a page that failed has an error screen", () => {
    expect(existsSync(path.join(root, "src/app/error.tsx"))).toBe(true);
  });

  it("the first version's addresses still work (redirects)", () => {
    const cfg = read("next.config.ts");
    for (const [from, to] of [["/home", "/dashboard"], ["/check", "/second-opinion"], ["/fall", "/guardrail/market-fall"], ["/improve", "/actions"]]) expect(cfg).toContain(`source: "${from}", destination: "${to}"`);
    expect(read("src/app/plan/page.tsx")).toContain("router.replace");
    expect(read("src/app/activity/page.tsx")).toContain("router.replace");
  });
});

describe("navigation rules", () => {
  it("picks the header: public on the landing page and for visitors, customer once a health check was started, adviser for an adviser", () => {
    expect(headerVariant("/", "customer", true)).toBe("public");
    expect(headerVariant("/", null, false)).toBe("public");
    expect(headerVariant("/learn", null, false)).toBe("public");
    expect(headerVariant("/learn", "customer", true)).toBe("customer");
    expect(headerVariant("/dashboard", "customer", true)).toBe("customer");
    expect(headerVariant("/adviser", "adviser", false)).toBe("adviser");
    expect(headerVariant("/settings", "adviser", false)).toBe("adviser");
  });

  it("marks the current customer item", () => {
    expect(customerActive("/dashboard")).toBe("home");
    expect(customerActive("/actions")).toBe("home");
    expect(customerActive("/intake")).toBe("home");
    expect(customerActive("/advice/case-priya")).toBe("plan");
    expect(customerActive("/case/case-priya/audit")).toBe("plan");
    expect(customerActive("/guardrail/market-fall")).toBe("plan");
    expect(customerActive("/second-opinion/result")).toBe("second");
    expect(customerActive("/learn")).toBe("learn");
    expect(customerActive("/settings")).toBe("settings");
    expect(customerActive("/about")).toBeNull();
  });

  it("marks the current adviser item", () => {
    expect(adviserActive("/adviser", null)).toBe("cases");
    expect(adviserActive("/adviser", "mine")).toBe("queue");
    expect(adviserActive("/adviser/case/x", null)).toBe("cases");
    expect(adviserActive("/adviser/case/x/copilot", null)).toBe("copilot");
    expect(adviserActive("/adviser/case/x/audit", null)).toBe("audit");
    expect(adviserActive("/settings", null)).toBe("settings");
  });

  it("My Plan leads to the case, or to the dashboard when there is none; Copilot and Audit follow the case in hand", () => {
    expect(planHref(null)).toBe("/dashboard");
    expect(planHref({ id: "case-priya" })).toBe("/case/case-priya");
    const q = [
      { id: "a", claimedBy: null, status: "DRAFT_READY" as const },
      { id: "b", claimedBy: { id: "me", name: "x" }, status: "IN_REVIEW" as const },
    ];
    expect(adviserFocusCase(q, "me")).toBe("b");
    expect(adviserFocusCase(q, "someone")).toBe("a");
    expect(adviserFocusCase([], "me")).toBeNull();
  });

  it("the draft and reviewed pages carry their own status banner, so the demo strip is left out there", () => {
    expect(hasOwnBanner("/advice/case-priya")).toBe(true);
    expect(hasOwnBanner("/case/case-priya/approved")).toBe(true);
    expect(hasOwnBanner("/case/case-priya")).toBe(false);
    expect(showsRichFooter("/intake", "customer")).toBe(false);
    expect(showsRichFooter("/dashboard", "customer")).toBe(true);
  });

  it("a case reference is short and readable", () => {
    expect(caseRef("case-priya")).toBe("PRIYA");
    expect(caseRef("case-a1b2c3d4e5f6")).toBe("A1B2C3");
  });
});

describe("the product is called ArthClear", () => {
  it("has one name, in the brand file", () => expect(APP_NAME).toBe("ArthClear"));

  it("no visible text or metadata still says Fin-Safe", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|json|css)$/.test(f) && /Fin-Safe|Fin Safe|FinSafe/.test(readFileSync(p, "utf8"))) hits.push(path.relative(root, p));
      }
    };
    walk(path.join(root, "src"));
    expect(hits).toEqual([]);
    expect(read("README.md").split("\n")[0]).toContain("ArthClear");
  });

  it("the layout, the link-preview image and the page titles use it", () => {
    expect(read("src/app/layout.tsx")).toContain("APP_NAME");
    expect(read("src/app/opengraph-image.tsx")).toContain("APP_NAME");
    expect(read("src/components/ds.tsx")).toContain("APP_NAME");
  });
});
