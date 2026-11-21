import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { en, hi, ta } from "./helpers";
import { translate } from "@/i18n";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

describe("i18n", () => {
  it("Hindi and Tamil define every English key (and no extras)", () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(hi).sort()).toEqual(keys);
    expect(Object.keys(ta).sort()).toEqual(keys);
  });
  it("placeholders match across languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(en)) {
      expect(ph((hi as Record<string, string>)[k]), `hi ${k}`).toBe(ph((en as Record<string, string>)[k]));
      expect(ph((ta as Record<string, string>)[k]), `ta ${k}`).toBe(ph((en as Record<string, string>)[k]));
    }
  });
  it("every literal t('key') used in the source exists", () => {
    const used = new Set<string>();
    for (const f of walk(path.resolve(__dirname, "../src"))) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
    }
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
  it("translations differ from English for UI text (not copied)", () => {
    expect(translate("hi", "nav.home")).not.toBe(translate("en", "nav.home"));
    expect(translate("ta", "nav.home")).not.toBe(translate("en", "nav.home"));
  });
  it("interpolates params", () => {
    expect(translate("en", "home.hi", { name: "Priya" })).toBe("Hi, Priya");
  });
});

// ---- WCAG AA contrast for the palette (PRD 11) ----
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
const mix = (fg: string, bg: string, pct: number) => {
  const f = hex(fg);
  const b = hex(bg);
  return "#" + f.map((c, i) => Math.round((c * pct + b[i] * (1 - pct)) * 255).toString(16).padStart(2, "0")).join("");
};

const THEMES = {
  light: { primary: "#0f5257", bg: "#faf7f2", surface: "#ffffff", fg: "#1f2937", muted: "#5b6a7e", draft: "#b45309", reviewed: "#166534", danger: "#b91c1c", info: "#3730a3", onPrimary: "#ffffff", header: "#0f5257", onHeader: "#ffffff" },
  dark: { primary: "#2dd4bf", bg: "#0b1220", surface: "#111827", fg: "#f8fafc", muted: "#94a3b8", draft: "#f59e0b", reviewed: "#4ade80", danger: "#f87171", info: "#818cf8", onPrimary: "#0b1220", header: "#0f172a", onHeader: "#f8fafc" },
} as const;

describe("WCAG AA contrast", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: text and key pairings are at least 4.5:1`, () => {
      const pairs: [string, string, string][] = [
        ["fg on bg", t.fg, t.bg],
        ["fg on surface", t.fg, t.surface],
        ["muted on bg", t.muted, t.bg],
        ["muted on surface", t.muted, t.surface],
        ["on-primary on primary", t.onPrimary, t.primary],
        ["on-header on header", t.onHeader, t.header],
        ["primary on surface", t.primary, t.surface],
        ["primary on bg", t.primary, t.bg],
        ["primary on its soft tint", t.primary, mix(t.primary, t.surface, 0.1)],
        ["draft on surface", t.draft, t.surface],
        ["draft on draft tint", t.draft, mix(t.draft, t.surface, 0.06)],
        ["reviewed on surface", t.reviewed, t.surface],
        ["reviewed on reviewed tint", t.reviewed, mix(t.reviewed, t.surface, 0.12)],
        ["danger on surface", t.danger, t.surface],
        ["danger on danger tint", t.danger, mix(t.danger, t.surface, 0.1)],
        ["info on surface", t.info, t.surface],
        ["info on info tint", t.info, mix(t.info, t.surface, 0.1)],
        ["fg on primary tint", t.fg, mix(t.primary, t.surface, 0.1)],
        ["fg on chat bubble", t.fg, mix(t.primary, t.surface, 0.16)],
        ["muted on primary tint", t.muted, mix(t.primary, t.surface, 0.1)],
      ];
      const fails = pairs.map(([n, a, b]) => ({ n, r: ratio(a, b) })).filter((x) => x.r < 4.5);
      expect(fails, JSON.stringify(fails)).toEqual([]);
    });
  }
});
