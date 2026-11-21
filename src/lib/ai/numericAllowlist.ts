// Version-controlled allowlist of explicitly NON-numeric phrases and fixed references.
// It must stay free of financial quantities. Adding an entry needs a `reason`;
// tests/numeric.test.ts exercises every entry automatically.
export interface AllowEntry {
  phrase: string;
  reason: string;
}

export const NUMERIC_ALLOWLIST: AllowEntry[] = [
  { phrase: "Section 80C", reason: "Fixed tax-section reference, not a quantity." },
  { phrase: "Section 80D", reason: "Fixed tax-section reference, not a quantity." },
  { phrase: "24x7", reason: "Availability wording, not a quantity." },
  { phrase: "one-time", reason: "Adjective meaning 'not repeated', not a quantity." },
  { phrase: "one time", reason: "Adjective meaning 'not repeated', not a quantity." },
  { phrase: "no one", reason: "Pronoun meaning 'nobody', not a quantity." },
  { phrase: "no one's", reason: "Possessive pronoun meaning 'nobody's', not a quantity." },
  { phrase: "any one", reason: "Pronoun meaning 'any person or thing', not a quantity." },
  { phrase: "every one", reason: "Pronoun meaning 'everybody', not a quantity." },
  { phrase: "each one", reason: "Pronoun meaning 'each person or thing', not a quantity." },
  { phrase: "one of", reason: "Partitive ('one of the risks'); any figure after it is still checked on its own." },
  { phrase: "one another", reason: "Reciprocal pronoun, not a quantity." },
  { phrase: "one's", reason: "Generic possessive ('one's goals'), not a quantity." },
];
