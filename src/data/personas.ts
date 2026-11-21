import type { Lang, PersonaId, UserProfile } from "@/types";

export const PRIYA: UserProfile = {
  id: "priya",
  name: "Priya",
  age: 24,
  city: "Chennai",
  cityTier: 1,
  language: "ta",
  incomeStable: true,
  monthlyIncome: 45000,
  essentialExpenses: 25000,
  otherExpenses: 10000,
  dependents: 0,
  familySize: 1,
  liquidSavings: 45000,
  goals: [
    { id: "g1", kind: "home", targetAmount: 800000, years: 7 },
    { id: "g2", kind: "travel", targetAmount: 100000, years: 2 },
  ],
  debts: [],
  insurance: [{ id: "i1", kind: "health", cover: 300000 }],
  holdings: [
    { id: "h1", label: "Sample Stock Tip A", assetClass: "equity", amount: 15000 },
    { id: "h2", label: "Sample Stock Tip B", assetClass: "equity", amount: 12000 },
    { id: "h3", label: "Sample Stock Tip C", assetClass: "equity", amount: 8000 },
  ],
  risk: { onFall: "sell", followsTips: true },
  isSynthetic: true,
};

export const RAMESH: UserProfile = {
  id: "ramesh",
  name: "Ramesh",
  age: 38,
  city: "Madurai",
  cityTier: 2,
  language: "ta",
  incomeStable: false,
  monthlyIncome: 55000,
  essentialExpenses: 38000,
  otherExpenses: 8000,
  dependents: 3,
  familySize: 4,
  liquidSavings: 60000,
  goals: [{ id: "g1", kind: "education", targetAmount: 600000, years: 9 }],
  debts: [
    { id: "d1", label: "Shop loan", outstanding: 350000, ratePct: 14, emi: 11000 },
    { id: "d2", label: "Card dues", outstanding: 40000, ratePct: 36, emi: 4000 },
  ],
  insurance: [
    { id: "i1", kind: "term", cover: 500000 },
    { id: "i2", kind: "health", cover: 200000 },
  ],
  holdings: [],
  risk: { onFall: "wait", followsTips: false },
  isSynthetic: true,
};

export const ANITA: UserProfile = {
  id: "anita",
  name: "Anita",
  age: 33,
  city: "Delhi",
  cityTier: 1,
  language: "hi",
  incomeStable: true,
  monthlyIncome: 120000,
  essentialExpenses: 55000,
  otherExpenses: 25000,
  dependents: 1,
  familySize: 3,
  liquidSavings: 330000,
  goals: [
    { id: "g1", kind: "retirement", targetAmount: 30000000, years: 27, savedSoFar: 900000 },
    { id: "g2", kind: "education", targetAmount: 4000000, years: 12, savedSoFar: 300000 },
  ],
  debts: [{ id: "d1", label: "Home loan", outstanding: 3500000, ratePct: 8.5, emi: 32000 }],
  insurance: [
    { id: "i1", kind: "term", cover: 15000000 },
    { id: "i2", kind: "health", cover: 1000000 },
  ],
  holdings: [
    { id: "h1", label: "Sample Equity Fund A", assetClass: "equity", amount: 180000 },
    { id: "h2", label: "Sample Equity Fund B", assetClass: "equity", amount: 150000 },
    { id: "h3", label: "Sample Index Fund C", assetClass: "equity", amount: 120000 },
    { id: "h4", label: "Sample Debt Fund A", assetClass: "debt", amount: 60000 },
  ],
  risk: { onFall: "wait", followsTips: false },
  isSynthetic: true,
};

/** Shown on the Fall screen when a user has no holdings. */
export const SAMPLE_PORTFOLIO = [
  { id: "s1", label: "Sample Equity Fund A", assetClass: "equity" as const, amount: 30000 },
  { id: "s2", label: "Sample Debt Fund A", assetClass: "debt" as const, amount: 20000 },
];

export function emptyProfile(lang: Lang): UserProfile {
  return {
    id: "fresh",
    name: "",
    age: 30,
    city: "",
    cityTier: 1,
    language: lang,
    incomeStable: true,
    monthlyIncome: 0,
    essentialExpenses: 0,
    otherExpenses: 0,
    dependents: 0,
    familySize: 1,
    liquidSavings: 0,
    goals: [],
    debts: [],
    insurance: [],
    holdings: [],
    risk: { onFall: "wait", followsTips: false },
    isSynthetic: true,
  };
}

export const PERSONAS: Record<Exclude<PersonaId, "fresh">, UserProfile> = {
  priya: PRIYA,
  ramesh: RAMESH,
  anita: ANITA,
};

export function profileFor(id: PersonaId, lang: Lang): UserProfile {
  if (id === "fresh") return emptyProfile(lang);
  return structuredClone(PERSONAS[id]);
}
