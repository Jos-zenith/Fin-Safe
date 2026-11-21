"use client";
import { useEffect } from "react";
import { useApp } from "@/store/AppProvider";

// Same four weights as Inter in the layout (400 regular, 500 medium, 600 semibold, 700 bold), so a Hindi or Tamil page
// has the same visual hierarchy as English instead of the browser faking the weights that were never loaded.
const SHEETS = {
  hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
  ta: "https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap",
} as const;

/**
 * Loads the Devanagari or Tamil webfont only once that language is in use. English pages never ask for either, and
 * the system fonts in globals.css cover the gap while the font arrives (display=swap).
 */
export function IndicFonts() {
  const { lang } = useApp();
  useEffect(() => {
    if (lang === "en") return;
    const id = `font-${lang}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = SHEETS[lang];
    document.head.appendChild(link);
  }, [lang]);
  return null;
}
