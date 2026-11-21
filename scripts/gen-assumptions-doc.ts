// Generates docs/ASSUMPTIONS.md from the registry. `npm run docs:assumptions` writes it;
// tests/docs.test.ts fails if the committed file is out of date.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderAssumptionsDoc } from "../src/lib/docs";

const out = path.resolve(__dirname, "../docs/ASSUMPTIONS.md");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, renderAssumptionsDoc());
console.log(`wrote ${out}`);
