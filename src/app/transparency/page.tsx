"use client";
import Link from "next/link";
import { Chip, Crumb, MainSide, useDocTitle } from "@/components/ds";
import { Card, LinkBtn } from "@/components/ui";
import { ECONOMICS } from "@/config/economics";
import { useApp } from "@/store/AppProvider";

/**
 * How the platform earns, in plain words. Conflicts come before revenue. Every amount is a placeholder and says so; the
 * switches (commissions, referral income, employer sponsorship) are read from src/config/economics.ts, so this page can
 * never say something the configuration does not.
 */
export default function Transparency() {
  const { t } = useApp();
  useDocTitle(t("nav2.earn"));
  const noCommission = !ECONOMICS.productCommissions;
  const noReferral = !ECONOMICS.referralIncome;
  const cross = <Chip tone="err" className="!size-7 !min-h-0 justify-center !p-0" aria-hidden>×</Chip>;
  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("nav2.earn") }]} />
      <div className="mt-4 grid items-end gap-8 wd:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] wd:gap-10">
        <div>
          <span className="t-label">{t("tr.kicker")}</span>
          <h1 className="t-display mt-4 text-[clamp(2.5rem,7vw,4.75rem)]">
            {t("tr.h1.a")} <span className="hl">{t("tr.h1.hl")}</span>
          </h1>
        </div>
        <p className="t-lead text-base md:text-[1.1875rem]">{t("tr.lead")}</p>
      </div>

      <Card tone="burg" className="mt-8 !p-8 max-md:!p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="ac-ic !size-[52px] text-[22px]" aria-hidden>!</span>
          <div className="min-w-[260px] flex-1">
            <h2 className="t-h2 !text-[#EAE7DD]">{t("tr.conflict.title")}</h2>
            <p className="mt-2 text-sm text-[#D8C7C1]">
              {noCommission && noReferral ? t("tr.conflict.body") : t("earn.demo")}
            </p>
          </div>
          <LinkBtn href="/compliance#conflicts" variant="lime">{t("tr.conflict.btn")}</LinkBtn>
        </div>
      </Card>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="t-label">{t("tr.earn.label")}</div>
          <h2 className="t-h2 mt-2">{t("tr.earn.1.t")}</h2>
          <div className="num mt-3 text-[clamp(1.75rem,4vw,2.5rem)]">{ECONOMICS.userFee}</div>
          <p className="mt-2 text-sm text-muted">{t("tr.earn.1.d")}</p>
        </Card>
        {ECONOMICS.employerSponsored && (
          <Card>
            <div className="t-label">{t("tr.earn.2.label")}</div>
            <h2 className="t-h2 mt-2">{t("tr.earn.2.t")}</h2>
            <div className="num mt-3 text-[clamp(1.75rem,4vw,2.5rem)]">{t("tr.earn.2.fee")}</div>
            <p className="mt-2 text-sm text-muted">{t("tr.earn.2.d")}</p>
          </Card>
        )}
        <Card tone="dark">
          <div className="t-label">{t("tr.not.label")}</div>
          <ul className="mt-4 flex flex-col gap-3">
            {[...(noCommission ? [1] : []), ...(noReferral ? [2] : []), 3, 4].map((k) => (
              <li key={k} className="flex items-center gap-2">{cross}{t(`tr.not.${k}`)}</li>
            ))}
          </ul>
        </Card>
      </div>

      <MainSide
        className="mt-8"
        main={
          <Card>
            <h2 className="t-h2">{t("tr.split.title")}</h2>
            <p className="mt-2 text-sm text-muted">{t("tr.split.note")}</p>
            <div className="mt-4 flex h-[42px] overflow-hidden rounded-[21px] text-xs font-bold" role="img" aria-label={t("tr.split.title")}>
              <div className="flex items-center bg-char pl-4 text-lime max-sm:pl-2" style={{ width: "45%" }}>{t("tr.split.1")}</div>
              <div className="flex items-center bg-burg pl-3.5 text-ivory max-sm:pl-2" style={{ width: "30%" }}>{t("tr.split.2")}</div>
              <div className="flex items-center bg-lav pl-3.5 text-char max-sm:pl-2" style={{ width: "25%" }}>{t("tr.split.3")}</div>
            </div>
            <div className="ac-scrollx mt-4">
              <table className="ac-tbl min-w-[520px]">
                <thead>
                  <tr><th scope="col">{t("tr.tbl.item")}</th><th scope="col">{t("tr.tbl.pay")}</th><th scope="col">{t("tr.tbl.who")}</th><th scope="col">{t("tr.tbl.vary")}</th></tr>
                </thead>
                <tbody>
                  <tr><td>{t("tr.tbl.fee")}</td><td className="num">{ECONOMICS.userFee}</td><td>{t("tr.tbl.fee.who")}</td><td>{t("tr.tbl.no")}</td></tr>
                  <tr><td>{t("tr.tbl.product")}</td><td className="num">₹0</td><td>{t("tr.tbl.product.who")}</td><td>{t("tr.tbl.na")}</td></tr>
                  <tr><td>{t("tr.tbl.commission")}</td><td className="num">{noCommission ? "₹0" : "—"}</td><td>{t("tr.tbl.commission.who")}</td><td>{t("tr.tbl.no")}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        }
        side={
          <>
            <Card tone="lav" small className="!p-6">
              <h2 className="t-h3">{t("tr.vs.title")}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="ac-inner !p-3.5"><b className="text-sm">{t("tr.vs.typical")}</b><p className="mt-2 text-xs">{t("tr.vs.typical.d")}</p></div>
                <div className="ac-inner !p-3.5"><b className="text-sm">{t("tr.vs.ours")}</b><p className="mt-2 text-xs">{t("tr.vs.ours.d")}</p></div>
              </div>
            </Card>
            <Card tone="dark" small className="!p-6">
              <h2 className="t-h4">{t("tr.related")}</h2>
              <div className="mt-3 flex flex-col text-sm">
                <Link href="/compliance" className="und inline-flex min-h-11 items-center text-lime">{t("footer.compliance")}</Link>
                <Link href="/sources" className="und inline-flex min-h-11 items-center text-lime">{t("footer.sources")}</Link>
                <Link href="/help" className="und inline-flex min-h-11 items-center text-lime">{t("footer.faq")}</Link>
              </div>
            </Card>
          </>
        }
      />
    </div>
  );
}
