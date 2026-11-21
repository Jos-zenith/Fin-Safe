"use client";
import { Calculator, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip, Crumb, useDocTitle } from "@/components/ds";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { Sheet } from "@/components/Sheet";
import { UnverifiedTag } from "@/components/UnverifiedTag";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { CONSTANTS } from "@/config/constants";
import { SAMPLE_REGISTRY, REGISTRY_BANNER } from "@/data/registry";
import { dragDefaults, flattenResults, NO_LADDER } from "@/lib/engine";
import { inr } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult } from "@/types";

type Cat = "all" | "ef" | "invest" | "mf" | "fraud" | "risk";
type Tone = "lav" | "burg" | "lime" | "dark" | "ivory";
interface Tile {
  id: "ef" | "sip" | "drag" | "reg" | "check" | "fall";
  cat: Exclude<Cat, "all">;
  tone: Tone;
  title: string;
  body: string;
  /** Tools open their own page; articles open here. */
  href?: string;
}
const CATS: Cat[] = ["all", "ef", "invest", "mf", "fraud", "risk"];

/**
 * The education library. Only content that exists is listed: the explainers below and the two practice tools. Each
 * article is general ("not about you"); the numbers in "Regular vs direct plans" come from the engine, with their formula.
 */
export default function Learn() {
  const { t } = useApp();
  const drag = useMemo(() => dragDefaults(), []);
  const engine = useMemo<EngineResult>(() => ({ results: [drag], ...flattenResults([drag]), flags: [], ladder: NO_LADDER }), [drag]);
  const v = drag.value as Record<string, number>;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [open, setOpen] = useState<null | Tile["id"]>(null);
  const [formula, setFormula] = useState(false);
  const [reg, setReg] = useState("");
  useDocTitle(t("nav2.learn"));

  const tiles: Tile[] = useMemo(
    () => [
      { id: "ef", cat: "ef", tone: "lav", title: t("learn.ef.t"), body: t("learn.ef.b") },
      { id: "check", cat: "fraud", tone: "burg", title: t("tools.check"), body: t("tools.checkSub"), href: "/second-opinion" },
      { id: "fall", cat: "risk", tone: "lime", title: t("tools.fall"), body: t("tools.fallSub"), href: "/guardrail/market-fall" },
      { id: "drag", cat: "mf", tone: "dark", title: t("learn.drag.t"), body: t("learn.drag.b", { corpus: inr(CONSTANTS.drag.corpus), years: CONSTANTS.drag.years }) },
      { id: "sip", cat: "invest", tone: "ivory", title: t("learn.sip.t"), body: t("learn.sip.b") },
      { id: "reg", cat: "fraud", tone: "ivory", title: t("learn.reg.t"), body: t("learn.reg.b") },
    ],
    [t],
  );
  const needle = q.trim().toLowerCase();
  const shown = tiles.filter((x) => (cat === "all" || x.cat === cat) && (!needle || `${x.title} ${x.body}`.toLowerCase().includes(needle)));
  const matches = reg.trim() ? SAMPLE_REGISTRY.filter((r) => r.name.toLowerCase().includes(reg.trim().toLowerCase())) : [];
  const catLabel = (c: Exclude<Cat, "all">) => t(`lr.cat.${c}`);
  const featured = shown.find((x) => x.id === "ef");
  const rest = shown.filter((x) => x !== featured);

  const card = (x: Tile, big = false) => {
    const tone = x.tone;
    const muted = tone === "burg" ? "text-[#D8C7C1]" : tone === "dark" ? "text-muted" : "";
    const chip = tone === "lav" || tone === "lime" ? <Chip tone="ink">{big ? `${t("lr.featured")} · ` : ""}{catLabel(x.cat)}</Chip> : tone === "burg" ? <Chip tone="lav">{catLabel(x.cat)}</Chip> : tone === "dark" ? <Chip tone="info">{catLabel(x.cat)}</Chip> : <Chip tone="neui">{catLabel(x.cat)}</Chip>;
    return (
      <Card key={x.id} tone={tone} className={`flex flex-col justify-between gap-6 ${big ? "min-h-[360px] md:row-span-2" : "min-h-[210px]"}`} data-testid={`learn-${x.id}`}>
        <div>
          {chip}
          <h2 className={`${big ? "t-h1 mt-4" : "t-h3 mt-3"} ${tone === "burg" ? "!text-[#EAE7DD]" : ""}`}>{x.title}</h2>
          {big && <p className="mt-3 max-w-[480px] text-[17px]">{x.body}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm ${muted}`}>{x.href ? t("lr.tool") : t("lr.langs")}</span>
          {x.href ? (
            <LinkBtn href={x.href} small variant={big ? "primary" : "secondary"}>{t("lr.open")}</LinkBtn>
          ) : (
            <Btn small variant={tone === "lav" ? "primary" : "secondary"} onClick={() => setOpen(x.id)}>{t("lr.read")}</Btn>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("nav2.learn") }]} />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Chip tone="info">{t("lr.chip")}</Chip>
          <h1 className="t-display mt-4 text-[clamp(2.25rem,6vw,4.5rem)]">
            {t("lr.h1.a")} <span className="hl">{t("lr.h1.hl")}</span>
          </h1>
        </div>
        <p className="t-lead max-w-[420px] text-base">{t("lr.lead")}</p>
      </div>

      {/* search first, then the topic filters; the language control lives in the header and the card footers list where each article exists */}
      <div className="mt-8 flex items-center gap-3 rounded-full border border-[#4a4a4a] bg-char px-6">
        <Search size={20} className="shrink-0 text-muted" aria-hidden />
        <label className="sr-only" htmlFor="learn-q">{t("lr.search.label")}</label>
        <input id="learn-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("lr.search.ph")} className="min-h-[58px] min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("lr.cats")}>
        {CATS.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className="ac-chip ac-chip-neu min-h-11 px-4 text-[13px]">
            {t(`lr.cat.${c}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="ac-ph mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center" role="status">
          <h2 className="t-h3 text-fg">{t("lr.none.title")}</h2>
          <p className="max-w-md text-sm">{t("lr.none.body")}</p>
          <Btn variant="secondary" small onClick={() => { setQ(""); setCat("all"); }}>{t("lr.none.clear")}</Btn>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]" data-testid="tools">
          {featured && card(featured, true)}
          {rest.map((x) => card(x))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Card tone="dark" small className="min-w-[300px] flex-1 !p-6">
          <b>{t("lr.related.title")}</b>
          <p className="mt-2 text-sm text-muted">{t("lr.related.body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkBtn href="/second-opinion" variant="secondary" small>{t("nav2.second")}</LinkBtn>
            <LinkBtn href="/dashboard" variant="secondary" small>{t("lr.related.dash")}</LinkBtn>
          </div>
        </Card>
        <Card tone="dark" small className="min-w-[300px] flex-1 !p-6">
          <b>{t("lr.disclaimer.title")}</b>
          <p className="mt-2 text-sm text-muted">{t("lr.disclaimer.body")}</p>
          <Link href="/sources" className="und mt-2 inline-block min-h-11 text-sm text-lav">{t("footer.sources")}</Link>
        </Card>
      </div>

      {/* the articles open in a sheet so the library stays where the person left it */}
      <Sheet open={open === "ef"} onClose={() => setOpen(null)} title={t("learn.ef.t")}>
        <Chip tone="info">EDUCATION</Chip>
        <p className="mt-3 text-base">{t("learn.ef.b")}</p>
      </Sheet>
      <Sheet open={open === "sip"} onClose={() => setOpen(null)} title={t("learn.sip.t")}>
        <Chip tone="info">EDUCATION</Chip>
        <p className="mt-3 text-base">{t("learn.sip.b")}</p>
      </Sheet>
      <Sheet open={open === "drag"} onClose={() => setOpen(null)} title={t("learn.drag.t")}>
        <Chip tone="info">EDUCATION</Chip>
        <UnverifiedTag ids={drag.assumptionIds} className="ml-2" />
        <p className="mt-3">{t("learn.drag.b", { corpus: inr(CONSTANTS.drag.corpus), years: CONSTANTS.drag.years })}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-[#2e2e2e] p-3"><p className="text-xs text-muted">{t("learn.drag.direct")}</p><p className="num text-xl">{inr(v.direct)}</p></div>
          <div className="rounded-2xl bg-[#2e2e2e] p-3"><p className="text-xs text-muted">{t("learn.drag.regular")}</p><p className="num text-xl">{inr(v.regular)}</p></div>
        </div>
        <p className="mt-3 text-sm">{t("learn.drag.diff", { diff: inr(v.diff) })}</p>
        <Btn variant="ghost" className="mt-1 !px-0" onClick={() => setFormula(true)}>
          <Calculator size={18} aria-hidden /> {t("evidence.how")}
        </Btn>
      </Sheet>
      <EvidenceSheet open={formula} onClose={() => setFormula(false)} title={t("learn.drag.t")} metricKey="drag" engine={engine} />
      <Sheet open={open === "reg"} onClose={() => setOpen(null)} title={t("learn.reg.t")}>
        <Chip tone="info">EDUCATION</Chip>
        <p className="mt-3">{t("learn.reg.b")}</p>
        <p className="mt-2 inline-block rounded-lg bg-[#2A2418] px-2 py-1 text-xs font-bold text-[#F3E2B3]">{REGISTRY_BANNER}</p>
        <label className="mt-3 flex items-center gap-2 rounded-2xl border border-[#4a4a4a] px-3">
          <Search size={18} className="text-muted" aria-hidden />
          <span className="sr-only">{t("learn.reg.ph")}</span>
          <input value={reg} onChange={(e) => setReg(e.target.value)} placeholder={t("learn.reg.ph")} className="min-h-12 flex-1 bg-transparent text-fg outline-none" />
        </label>
        {reg.trim() && (
          <ul className="mt-2 space-y-2" aria-live="polite">
            {matches.length ? (
              matches.map((m) => (
                <li key={m.name} className="rounded-xl bg-[#2e2e2e] p-3 text-sm"><span className="font-semibold">{m.name}</span> · {m.status} · {m.city}</li>
              ))
            ) : (
              <li className="rounded-xl bg-[#2A2418] p-3 text-sm text-[#F3E2B3]">{t("learn.reg.none")}</li>
            )}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
