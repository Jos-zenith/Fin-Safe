// Navigation rules shared by the header, the mobile bar and the footer. Pure functions, so they are easy to test.
import type { Case } from "@/types";

export type HeaderVariant = "public" | "customer" | "adviser";

/**
 * Which header a route gets (wireframes: Main > "Navigation architecture").
 * - An adviser session always gets the adviser header.
 * - The landing page always gets the light public header (logo, education links, two entry points).
 * - Once someone has started a health check, every other page shows the customer navigation, so My Plan is never far.
 */
export function headerVariant(path: string, role: "customer" | "adviser" | null, hasProfile: boolean): HeaderVariant {
  if (path === "/") return "public";
  if (role === "adviser") return "adviser";
  return hasProfile ? "customer" : "public";
}

export type CustomerNavId = "home" | "plan" | "second" | "learn" | "settings";
export type AdviserNavId = "cases" | "queue" | "copilot" | "audit" | "settings";

const starts = (path: string, ...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/** The customer item to mark as the current page. The action center and intake belong to Home; the guardrail to My Plan. */
export function customerActive(path: string): CustomerNavId | null {
  if (starts(path, "/dashboard", "/intake", "/actions", "/improve", "/home")) return "home";
  if (starts(path, "/advice", "/case", "/plan", "/confirm", "/agreement", "/guardrail", "/fall", "/activity", "/assumptions")) return "plan";
  if (starts(path, "/second-opinion", "/check")) return "second";
  if (starts(path, "/learn")) return "learn";
  if (starts(path, "/settings")) return "settings";
  return null;
}

export function adviserActive(path: string, view: string | null): AdviserNavId | null {
  if (path.startsWith("/adviser/case/") && path.endsWith("/copilot")) return "copilot";
  if (path.startsWith("/adviser/case/") && path.endsWith("/audit")) return "audit";
  if (starts(path, "/adviser")) return view === "mine" ? "queue" : "cases";
  if (starts(path, "/settings")) return "settings";
  return null;
}

/** Where "My Plan" leads: the case if there is one (its status page), otherwise the dashboard, where the plan is requested. */
export function planHref(c: Pick<Case, "id"> | null | undefined): string {
  return c ? `/case/${encodeURIComponent(c.id)}` : "/dashboard";
}

/** The case an adviser is working on (claimed by them and in review), else the first waiting one; the target of Copilot and Audit. */
export function adviserFocusCase(queue: Pick<Case, "id" | "claimedBy" | "status">[], meId: string | undefined): string | null {
  const mine = queue.find((c) => meId && c.claimedBy?.id === meId && c.status === "IN_REVIEW");
  return (mine ?? queue[0])?.id ?? null;
}

/** Pages that show the rich footer (the public pages and the customer pages); the intake and adviser screens stay focused. */
export function showsRichFooter(path: string, variant: HeaderVariant): boolean {
  if (variant === "adviser") return false;
  return !starts(path, "/intake", "/guardrail");
}

/** Pages whose first element is a status banner (draft or reviewed) in place of the demo strip. */
export function hasOwnBanner(path: string): boolean {
  return /^\/advice\/[^/]+$/.test(path) || /^\/case\/[^/]+\/approved$/.test(path);
}

/** Short reference shown to people ("PRIYA", "A1B2C3"), from the case id. The full id stays in the address. */
export function caseRef(id: string): string {
  return id.replace(/^case-?/i, "").slice(0, 6).toUpperCase() || id.toUpperCase();
}
