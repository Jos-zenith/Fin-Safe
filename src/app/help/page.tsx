"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Crumb, useDocTitle } from "@/components/ds";
import { Sheet } from "@/components/Sheet";
import { Btn, Card } from "@/components/ui";
import { FAQ, type FaqCat } from "@/content/faq";
import { useApp } from "@/store/AppProvider";

const CATS: FaqCat[] = ["ai", "data", "second", "language", "demo", "fees"];
const SHOWN = 6;

/** Highlight the words that matched the search. */
function Mark({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-lime px-0.5 text-char">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

/** Search leads; one answer is open at a time. The answers are in English for now, and the page says so. */
export default function Help() {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FaqCat | "all">("ai");
  const [open, setOpen] = useState<string | null>("draft");
  const [more, setMore] = useState(false);
  const [contact, setContact] = useState(false);
  useDocTitle(t("menu.help"));
  const needle = q.trim().toLowerCase();

  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c, FAQ.filter((f) => f.cat === c).length])) as Record<FaqCat, number>, []);
  // searching looks across every category; otherwise the chosen category is shown
  const list = FAQ.filter((f) => (needle ? `${f.q} ${f.a}`.toLowerCase().includes(needle) : cat === "all" || f.cat === cat));
  const visible = more || needle ? list : list.slice(0, SHOWN);

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("menu.help") }]} />
      <h1 className="t-display mt-4 text-[clamp(2.5rem,7vw,4.5rem)]">
        {t("hp.h1.pre")} <span className="hl">{t("hp.h1.hl")}</span>
      </h1>
      <div className="mt-6 flex max-w-[760px] items-center gap-3 rounded-full border border-[#4a4a4a] bg-char px-6">
        <Search size={20} className="shrink-0 text-muted" aria-hidden />
        <label className="sr-only" htmlFor="hp-q">{t("hp.search.ph")}</label>
        <input id="hp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hp.search.ph")} className="min-h-[62px] min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted" />
      </div>
      <p className="mt-2 text-xs text-muted" role="note">{t("hp.lang.body")}</p>

      <div className="mt-8 grid items-start gap-7 wd:grid-cols-[270px_minmax(0,1fr)_330px]">
        <nav aria-label={t("hp.cats")} className="flex gap-2 max-wd:overflow-x-auto wd:flex-col wd:gap-1">
          {CATS.map((c) => (
            <button key={c} type="button" aria-pressed={!needle && cat === c} onClick={() => { setCat(c); setQ(""); setMore(false); setOpen(null); }} className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-[14px] border px-4 py-2.5 text-left text-sm ${!needle && cat === c ? "border-lime bg-[#242424] font-bold text-fg" : "border-transparent text-muted hover:text-fg"}`}>
              <span>{t(`hp.cat.${c}`)}</span><span>{counts[c]}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-3" lang="en">
          {visible.length === 0 ? (
            <div className="ac-ph p-6 text-center" role="status">
              <h2 className="t-h3 text-fg">{t("hp.none.title")}</h2>
              <p className="mt-2 text-sm">{t("hp.none.body")}</p>
            </div>
          ) : (
            visible.map((f) => {
              const on = open === f.id;
              return (
                <div key={f.id} className="s-ivory rounded-[20px] bg-ivory px-6 py-5 max-md:px-4">
                  <h2 className="m-0">
                    <button type="button" aria-expanded={on} aria-controls={`faq-${f.id}`} onClick={() => setOpen(on ? null : f.id)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-base font-bold">
                      <span><Mark text={f.q} needle={needle} /></span>
                      <span aria-hidden className="text-xl">{on ? "−" : "＋"}</span>
                    </button>
                  </h2>
                  {on && (
                    <div id={`faq-${f.id}`} className="mt-3 text-sm leading-relaxed text-[#3d3b34]">
                      <Mark text={f.a} needle={needle} />{" "}
                      {f.link && <Link href={f.link.href} className="und font-semibold">{f.link.label}</Link>}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {!needle && list.length > SHOWN && (
            <div className="s-dark ac-card-s ac-bordered bg-[#242424] text-center">
              <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="und min-h-11 font-semibold text-lime">
                {more ? t("hp.less") : t("hp.more", { n: list.length - SHOWN })}
              </button>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card tone="lime" small className="!p-6">
            <h2 className="t-h3">{t("hp.contact.title")}</h2>
            <p className="mt-2 text-sm text-muted">{t("hp.contact.body")}</p>
            <Btn block className="mt-4" onClick={() => setContact(true)}>{t("hp.contact.btn")}</Btn>
            <p className="mt-2 text-xs text-muted">{t("hp.contact.note")}</p>
          </Card>
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("hp.quick")}</h2>
            <div className="mt-3 flex flex-col text-sm">
              <Link href="/second-opinion" className="und inline-flex min-h-11 items-center text-lime">{t("hp.quick.check")}</Link>
              <Link href="/settings" className="und inline-flex min-h-11 items-center text-lime">{t("co.related.clear")}</Link>
              <Link href="/compliance" className="und inline-flex min-h-11 items-center text-lime">{t("footer.compliance")}</Link>
              <Link href="/transparency" className="und inline-flex min-h-11 items-center text-lime">{t("nav2.earn")}</Link>
            </div>
          </Card>
          <Card tone="lav" small className="!p-6">
            <h2 className="t-h4">{t("hp.lang.title")}</h2>
            <p className="mt-2 text-sm">{t("hp.lang.body")}</p>
          </Card>
        </aside>
      </div>

      <Sheet open={contact} onClose={() => setContact(false)} title={t("hp.contact.btn")}>
        <p className="text-muted">{t("hp.sheet.body")}</p>
        <Btn block className="mt-4" onClick={() => setContact(false)}>{t("common.ok")}</Btn>
      </Sheet>
    </div>
  );
}
