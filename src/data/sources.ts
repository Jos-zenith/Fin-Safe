// Any statistic shown in the UI must come from here, with a source and an as-of date.
export interface SourcedStat {
  id: string;
  label: string;
  value: string;
  source: string;
  asOf: string;
}

export const SOURCES: SourcedStat[] = [
  {
    id: "demat_accounts",
    label: "Demat accounts in India",
    value: "TO_VERIFY",
    source: "TO_VERIFY (depository monthly data)",
    asOf: "TO_VERIFY",
  },
  {
    id: "registered_advisers",
    label: "Registered investment advisers",
    value: "TO_VERIFY",
    source: "TO_VERIFY (regulator public registry)",
    asOf: "TO_VERIFY",
  },
];
