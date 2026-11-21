import type { Holding, HoldingClass } from "@/types";

/** "label,amount[,type]" per line. Long digit strings are dropped (they could be account numbers). */
export function parseHoldingsCsv(text: string): Holding[] {
  const out: Holding[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [label, amt, type] = line.split(",").map((s) => s.trim());
    const amount = Number((amt ?? "").replace(/[^\d.]/g, ""));
    if (!label || !amount || label.length > 40 || /\d{8,}/.test(label)) continue;
    const l = `${label} ${type ?? ""}`.toLowerCase();
    const assetClass: HoldingClass = l.includes("gold") ? "gold" : l.includes("debt") || l.includes("bond") ? "debt" : l.includes("intl") || l.includes("global") ? "international_equity" : "equity";
    out.push({ id: `h${out.length + 1}`, label, assetClass, amount });
    if (out.length >= 15) break;
  }
  return out;
}
