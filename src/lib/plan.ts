// Show a stored plan item in the viewer's language without a network call.
import { localFixture } from "@/lib/ai/run";
import type { PlanItem, PlanPack } from "@/lib/ai/schemas";
import type { Case, Lang } from "@/types";

const cache = new Map<string, PlanPack>();

function packIn(c: Case, lang: Lang): PlanPack {
  if (c.plan.lang === lang) return c.plan;
  const key = `${c.id}:${lang}:${c.plan.items.map((i) => i.id).join(",")}`;
  let p = cache.get(key);
  if (!p) {
    p = localFixture({ task: "draftPlanPack", language: lang, profile: c.profile }) as PlanPack;
    cache.set(key, p);
  }
  return p;
}

/** Returns the item's text in `lang` (same item id), or the stored item if no translation exists. */
export function itemInLang(c: Case, item: PlanItem, lang: Lang): PlanItem {
  const found = packIn(c, lang).items.find((i) => i.id === item.id);
  return found ?? item;
}

export function packTextIn(c: Case, lang: Lang): Pick<PlanPack, "summary" | "checklist" | "adviserQuestions"> {
  return packIn(c, lang);
}
