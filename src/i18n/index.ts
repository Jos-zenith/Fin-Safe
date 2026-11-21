import type { Lang } from "@/types";
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";

const DICT: Record<Lang, Record<string, string>> = { en, hi, ta };

export type Params = Record<string, string | number>;
export type TFn = (key: string, params?: Params) => string;

export function translate(lang: Lang, key: string, params?: Params): string {
  const raw = DICT[lang][key] ?? DICT.en[key] ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k] ?? `{${k}}`)) : raw;
}

export const LANGS: { id: Lang; short: string; full: string }[] = [
  { id: "en", short: "EN", full: "English" },
  { id: "hi", short: "हि", full: "हिन्दी" },
  { id: "ta", short: "த", full: "தமிழ்" },
];

export const dictionaries = DICT;
