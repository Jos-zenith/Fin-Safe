"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip, Crumb, PageHead, useDocTitle } from "@/components/ds";
import { Card, LinkBtn } from "@/components/ui";
import { ASSUMPTIONS, statusOf } from "@/config/assumptions";
import { groupOf } from "@/config/assumptionGroups";
import { SOURCES } from "@/data/sources";
import { useApp } from "@/store/AppProvider";

interface Row {
  key: string;
  name: string;
  publisher: string;
  published: string;
  asOf: string;
  method: string;
  metric: string;
  used: string;
  status: "verify" | "reviewed" | "notmod";
  /** A row with no publisher or no date cannot be cited as fact; it is highlighted. */
  flagged: boolean;
}
const missing = (v: string) => !v || v.includes("TO_VERIFY") || v.includes("demo placeholder");

/**
 * Every statistic and assumption behind the figures, with its publisher and date. Nothing here is an invented
 * citation: where the registry says "demo placeholder, TO_VERIFY", that is what is shown, and the row is flagged.
 */
export default function Sources() {
  const { t, reviews } = useApp();
  const [q, setQ] = useState("");
  const [metric, setMetric] = useState("all");
  useDocTitle(t("footer.sources"));

  const rows = useMemo<Row[]>(
    () => [
      ...SOURCES.map<Row>((s) => ({
        key: `stat-${s.id}`,
        name: s.label,
        publisher: s.source,
        published: "—",
        asOf: s.asOf,
        method: t("sr.stat"),
        metric: t("assump.g.other"),
        used: "—",
        status: "verify",
        flagged: true,
      })),
      ...ASSUMPTIONS.map<Row>((a) => {
        const st = a.notModelled ? "notmod" : statusOf(a.id, reviews) === "reviewed" ? "reviewed" : "verify";
        return {
          key: a.id,
          name: a.id,
          publisher: a.source,
          published: "—",
          asOf: a.asOf,
          method: a.description,
          metric: t(groupOf(a.id)),
          used: a.applicability,
          status: st,
          flagged: missing(a.source) || missing(a.asOf),
        };
      }),
    ],
    [t, reviews],
  );
  const metrics = [...new Set(rows.map((r) => r.metric))];
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (metric === "all" || r.metric === metric) && (!needle || `${r.name} ${r.method} ${r.metric} ${r.publisher}`.toLowerCase().includes(needle)));

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("footer.compliance"), href: "/compliance" }, { label: t("footer.sources") }]} />
      <PageHead title={t("sr.title")} sub={t("sr.sub")} actions={<Chip tone="warn">{t("sr.chip")}</Chip>} />

      <Card tone="lav" className="mt-6 !p-6">
        <b>{t("sr.calc")}</b> {t("sr.calc.body")}
      </Card>

      <Card className="mt-6 !p-6 max-md:!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative flex min-w-[260px] max-w-[420px] flex-1 items-center">
            <Search size={16} className="pointer-events-none absolute left-4 text-[#77746a]" aria-hidden />
            <span className="sr-only">{t("sr.search")}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sr.search")} className="ac-field !min-h-11 !pl-10 text-sm" />
          </label>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("sr.metric")}>
            <span className="t-label">{t("sr.metric")}</span>
            <button type="button" aria-pressed={metric === "all"} onClick={() => setMetric("all")} className="ac-chip ac-chip-neui min-h-11 px-3.5">{t("ad.f.all")}</button>
            {metrics.map((m) => (
              <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)} className="ac-chip ac-chip-neui min-h-11 px-3.5">{m}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="ac-ph mt-4 p-6 text-center text-sm" role="status">{t("sr.none")}</p>
        ) : (
          <div className="ac-scrollx mt-4">
            <table className="ac-tbl min-w-[1100px] text-[13px]" data-testid="sources-table">
              <thead>
                <tr>{(["name", "pub", "published", "asof", "method", "metric", "used", "status"] as const).map((h) => <th key={h} scope="col">{t(`sr.h.${h}`)}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key} className={r.flagged ? "bg-[#F6EBC8]" : ""}>
                    <td className="break-words font-mono text-xs"><b>{r.name}</b></td>
                    <td>{r.publisher}</td>
                    <td>{r.published}</td>
                    <td>{r.asOf}</td>
                    <td className="max-w-[34ch]">{r.method}</td>
                    <td><Chip tone="neui">{r.metric}</Chip></td>
                    <td className="max-w-[24ch]">{r.used}</td>
                    <td>{r.status === "reviewed" ? <Chip tone="ok">{t("assump.reviewed")}</Chip> : r.status === "notmod" ? <Chip tone="neui">{t("sr.notmod")}</Chip> : <Chip tone="warn">{t("sr.verify")}</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">{t("sr.note")}</p>
      </Card>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card tone="dark" small className="!p-6">
          <h2 className="t-h4">{t("assump.title")}</h2>
          <p className="mt-2 text-sm text-muted">{t("assump.sub")}</p>
          <Link href="/assumptions" className="und mt-3 inline-flex min-h-11 items-center text-sm text-lime">{t("assump.title")}</Link>
        </Card>
        <Card tone="dark" small className="!p-6">
          <h2 className="t-h4">{t("sr.report.title")}</h2>
          <p className="mt-2 text-sm text-muted">{t("sr.report.body")}</p>
          <LinkBtn href="/help" variant="secondary" small className="mt-3">{t("sr.report.btn")}</LinkBtn>
        </Card>
      </div>
    </div>
  );
}
