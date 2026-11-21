"use client";
import { useApp } from "@/store/AppProvider";

/**
 * A diagonal "DRAFT" mark across every screen that shows a plan that has not been reviewed, and a banner that appears only
 * when the page is printed or saved as PDF. Position "fixed" repeats the mark on every printed page. It never blocks a
 * click (pointer-events none) and is hidden from screen readers, because the visible DRAFT banner already says it in words.
 */
export function DraftWatermark() {
  const { t } = useApp();
  return (
    <>
      <p data-testid="draft-print-banner" className="mb-3 hidden rounded-xl border-2 border-draft p-3 text-center text-lg font-bold text-draft print:block">
        {t("draft.print")}
      </p>
      <div aria-hidden data-testid="draft-watermark" className="draft-watermark pointer-events-none fixed inset-0 z-[5] grid select-none place-items-center overflow-hidden">
        <span className="-rotate-[28deg] whitespace-nowrap text-[clamp(1.5rem,8.5vw,8.5rem)] font-black tracking-widest text-draft/10 print:text-draft/25">{t("draft.watermark")}</span>
      </div>
    </>
  );
}
