import { ASSUMPTIONS } from "@/config/assumptions";

/** The text of docs/ASSUMPTIONS.md, built from the registry so it can never drift from the code. */
export function renderAssumptionsDoc(): string {
  const rows = ASSUMPTIONS.filter((a) => !a.notModelled)
    .map((a) => `| \`${a.id}\` | ${a.value} | ${a.unit} | ${a.description} | ${a.source} | ${a.asOf} | ${a.confidence} | ${a.reviewStatus} |`)
    .join("\n");
  const notModelled = ASSUMPTIONS.filter((a) => a.notModelled)
    .map((a) => `- \`${a.id}\`: ${a.description}`)
    .join("\n");
  return `# Assumptions behind the numbers

> Generated from \`src/config/assumptions.ts\` by \`npm run docs:assumptions\`. Do not edit by hand.

**Every value below is a demo placeholder.** None has been reviewed by a qualified professional, and no entry
has a real source. Where there is no real source it says "demo placeholder, TO_VERIFY". Nothing is pre-marked
reviewed. An adviser can mark an assumption reviewed inside the demo (name and date, audited), which is a demo
workflow and not a regulatory approval.

The engine reads only from this registry (\`tests/assumptions.test.ts\` fails if a financial constant is
hardcoded in \`src/lib/engine\`). Every engine result lists the assumption ids it used, and any figure or plan
item built on an unverified assumption shows a visible "Uses unverified assumptions" tag.

## Registry

| id | value | unit | description | source | as of | confidence | status |
|---|---|---|---|---|---|---|---|
${rows}

## Not modelled

${notModelled}

## How goal results use them

- The amount a user enters is in **today's money**. It is raised for inflation to the goal date (pessimistic = high inflation, optimistic = low inflation).
- Savings already set aside for the goal are counted, **with growth**, before the monthly amount is worked out.
- Returns are taken **after** the assumed yearly fee (\`fee.expense_ratio\`).
- Results are a **range** (pessimistic / base / optimistic), never a promise.
- **Taxes are not included** and every goal result says so.

## Who must review these

A qualified adviser or other professional must review and replace these placeholders before any real use.
Reviewing them is outside what this repository can do.
`;
}
