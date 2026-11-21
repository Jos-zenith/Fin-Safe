// The ArthClear surfaces (src/app/globals.css) redefine the colour variables, so one component is readable on a dark page
// and on an ivory, lime, burgundy or lavender card. This reads the stylesheet itself and checks WCAG AA (4.5:1) for the
// pairings the components use, on every surface.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf8");

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const mix = (fg: string, bg: string, pct: number) => "#" + hex(fg).map((c, i) => Math.round((c * pct + hex(bg)[i] * (1 - pct)) * 255).toString(16).padStart(2, "0")).join("");

/** The variables a surface block defines, read from the stylesheet. */
function surface(selector: string): Record<string, string> {
  const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
  expect(m, `${selector} block`).toBeTruthy();
  return Object.fromEntries([...m![1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((x) => [x[1], x[2]]));
}

const SURFACES = [".s-ivory", ".s-lime", ".s-burg", ".s-lav"] as const;
// the dark page is the :root / .s-dark block, which is declared together
const dark = () => {
  const m = css.match(/:root,\s*\n\.s-dark\s*\{([^}]*)\}/);
  expect(m).toBeTruthy();
  return Object.fromEntries([...m![1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((x) => [x[1], x[2]]));
};

describe("every surface keeps text and status colours at 4.5:1 or better", () => {
  const all: [string, Record<string, string>][] = [["dark page", dark()], ...SURFACES.map((s) => [s, surface(s)] as [string, Record<string, string>])];
  for (const [name, v] of all) {
    it(name, () => {
      const pairs: [string, string, string][] = [
        ["fg on surface", v.fg, v.surface],
        ["fg on bg (inputs and inner panels)", v.fg, v.bg],
        ["muted on surface", v.muted, v.surface],
        ["muted on bg", v.muted, v.bg],
        ["on-primary on primary (the primary button)", v["on-primary"], v.primary],
        ["primary on surface", v.primary, v.surface],
        ["draft on surface", v.draft, v.surface],
        ["draft on its soft tint", v.draft, mix(v.draft, v.surface, 0.08)],
        ["reviewed on surface", v.reviewed, v.surface],
        ["reviewed on its soft tint", v.reviewed, mix(v.reviewed, v.surface, 0.12)],
        ["danger on surface", v.danger, v.surface],
        ["danger on its soft tint", v.danger, mix(v.danger, v.surface, 0.1)],
        ["info on surface", v.info, v.surface],
        ["info on its soft tint", v.info, mix(v.info, v.surface, 0.1)],
        ["fg on a primary tint", v.fg, mix(v.primary, v.surface, 0.1)],
        ["muted on a primary tint", v.muted, mix(v.primary, v.surface, 0.1)],
      ];
      const fails = pairs.map(([n, a, b]) => ({ n, r: Math.round(ratio(a, b) * 100) / 100 })).filter((x) => x.r < 4.5);
      expect(fails, JSON.stringify(fails)).toEqual([]);
    });
  }

  it("the fixed chip fills hold 4.5:1 on dark and on ivory", () => {
    const chips: [string, string][] = [["#0b3b20", "#9adbb4"], ["#3d2a00", "#f2c14e"], ["#4a0f0f", "#f0a3a3"], ["#0e2a52", "#9cc2f5"], ["#f7f6f0", "#3a3a3a"], ["#2b2a26", "#d5d1c4"], ["#171717", "#a9a1e8"], ["#171717", "#c7ff00"], ["#f7f6f0", "#171717"]];
    for (const [fg, bg] of chips) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the design uses the approved tokens", () => {
  it("defines the brand colours from the wireframes", () => {
    for (const c of ["--lime: #c7ff00", "--burg: #43000b", "--lav: #a9a1e8", "--ivory: #eae7dd", "--char: #171717", "--char2: #242424"]) expect(css).toContain(c);
  });
  it("keeps component classes in the components layer, so a Tailwind utility on the same element wins", () => {
    expect(css).toMatch(/@layer components\s*\{[\s\S]*\.ac-btn\s*\{/);
  });
});
