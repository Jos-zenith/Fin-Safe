"use client";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { amountInWords, groupIndian, inr } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import { Btn } from "./ui";
import { VoiceButton } from "./Voice";

/**
 * UPI-style amount entry: big number, the same amount in words, quick-pick amounts, numeric keypad, one primary action.
 * The words line is what catches a stray extra zero (there is a 00 key right next to 0), so it shows for every rupee amount.
 */
export function AmountPad({
  initial,
  prefix = "₹",
  suffix = "",
  per,
  decimal,
  max = 1e9,
  quick,
  warnAbove,
  submitLabel,
  onSubmit,
  secondary,
}: {
  initial: number;
  prefix?: string;
  suffix?: string;
  /** A small unit shown after the number, e.g. "/month", so it is clear what period the amount covers. */
  per?: string;
  decimal?: boolean;
  max?: number;
  /** A few common amounts to tap instead of typing. They only fill the box; the person still presses Continue. */
  quick?: number[];
  /** From this amount up, ask the person to check the zeros. A soft nudge, never a block. */
  warnAbove?: number;
  submitLabel: string;
  onSubmit: (n: number) => void;
  secondary?: { label: string; onClick: () => void };
}) {
  const { t, lang } = useApp();
  const [raw, setRaw] = useState(initial ? String(initial) : "");

  const press = (k: string) =>
    setRaw((r) => {
      if (k === "back") return r.slice(0, -1);
      if (k === ".") return decimal && !r.includes(".") ? (r || "0") + "." : r;
      const next = (r === "0" ? "" : r) + k;
      return Number(next) > max || next.length > 11 ? r : next;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "BUTTON"].includes(el.tagName) && e.key !== "Backspace") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "." && decimal) press(".");
      else if (e.key === "Enter") onSubmit(Number(raw || 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [whole, frac] = raw.split(".");
  const shown = `${groupIndian(Number(whole || 0))}${frac !== undefined ? "." + frac : ""}`;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", decimal ? "." : "00", "0", "back"];
  const value = Number(raw || 0);
  // words only make sense for whole rupee amounts, not for "12.5 %" or "5 years"
  const words = prefix === "₹" && !decimal ? amountInWords(value, lang, { rupee: t("amount.rupee"), rupees: t("amount.rupees"), thousand: t("amount.thousand"), lakh: t("amount.lakh"), crore: t("amount.crore") }) : "";
  const bigAmount = warnAbove !== undefined && value >= warnAbove;

  return (
    <div>
      {quick && quick.length > 0 && (
        <div className="mb-2 flex gap-1.5" role="group" aria-label={t("intake.quickPick")}>
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={value === q}
              onClick={() => setRaw(String(q))}
              className={`num min-h-9 flex-1 rounded-full border px-2 text-sm font-semibold transition active:scale-95 ${
                value === q ? "border-primary bg-primary-soft text-primary" : "border-line bg-bg hover:border-primary/60"
              }`}
            >
              {inr(q)}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1 text-center">
          <p className={`num font-bold ${shown.length > 9 ? "text-3xl" : "text-4xl"}`} aria-live="polite" aria-label={`${prefix}${shown}${suffix}${per ?? ""}`}>
            {/* the symbol and digits never split; if the unit does not fit it drops to the next line instead */}
            <span className="whitespace-nowrap">
              <span className="text-muted">{prefix}</span> {shown}
              <span className="text-muted">{suffix}</span>
            </span>
            {per && (
              <>
                {" "}
                <span className="text-base font-medium text-muted">{per}</span>
              </>
            )}
          </p>
          <p className="min-h-5 text-sm text-muted">{words}</p>
          {bigAmount && (
            <p role="status" className="text-xs font-semibold text-draft">
              {t("intake.checkZeros")}
            </p>
          )}
        </div>
        <VoiceButton caption onText={(txt) => setRaw(String(parseFloat(txt.replace(/[^\d.]/g, "")) || ""))} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label={t("intake.keypad")}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "00" ? (press("0"), press("0")) : press(k))}
            aria-label={k === "back" ? t("common.delete") : k}
            className="grid min-h-12 place-items-center rounded-xl bg-primary-soft text-xl font-semibold active:scale-95 [@media(max-height:640px)]:min-h-10 [@media(max-height:560px)]:min-h-9"
          >
            {k === "back" ? <Delete size={22} aria-hidden /> : k}
          </button>
        ))}
      </div>
      <div className={`mt-2 grid gap-2 ${secondary ? "grid-cols-2" : ""}`}>
        {secondary && (
          <Btn variant="secondary" onClick={secondary.onClick}>
            {secondary.label}
          </Btn>
        )}
        <Btn onClick={() => onSubmit(Number(raw || 0))}>{submitLabel}</Btn>
      </div>
    </div>
  );
}
