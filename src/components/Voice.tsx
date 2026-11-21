"use client";
import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/store/AppProvider";

interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
}
type Ctor = new () => Recognition;

const LOCALE = { en: "en-IN", hi: "hi-IN", ta: "ta-IN" } as const;

/**
 * Optional voice input (Web Speech API). Renders nothing when the browser has no support.
 * It is drawn as a button (ring, hover, a pulse while listening); `caption` adds "Tap to speak" underneath for
 * first-time and regional-language users.
 */
export function VoiceButton({ onText, caption }: { onText: (text: string) => void; caption?: boolean }) {
  const { t, lang } = useApp();
  const [Rec, setRec] = useState<Ctor | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRec(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);
  if (!Rec) return null;
  const start = () => {
    const r = new Rec();
    r.lang = LOCALE[lang];
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setLive(false);
    r.onerror = () => setLive(false);
    setLive(true);
    r.start();
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={start}
        disabled={live}
        aria-label={t("intake.voice")}
        aria-pressed={live}
        className={`relative grid size-11 place-items-center rounded-full border-2 transition active:scale-95 ${
          live ? "border-primary bg-primary text-onprimary" : "border-primary/50 bg-primary-soft text-primary hover:border-primary hover:bg-primary/15"
        }`}
      >
        {live && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/40 motion-reduce:hidden" />}
        <Mic size={20} aria-hidden className="relative" />
      </button>
      {caption && (
        <span role="status" className={`max-w-20 text-center text-[11px] font-medium leading-tight ${live ? "text-primary" : "text-muted"}`}>
          {live ? t("intake.listening") : t("intake.voiceHint")}
        </span>
      )}
    </div>
  );
}
