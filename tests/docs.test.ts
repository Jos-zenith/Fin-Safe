import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderAssumptionsDoc } from "@/lib/docs";

describe("generated docs stay in sync", () => {
  it("docs/ASSUMPTIONS.md matches the registry (run `npm run docs:assumptions`)", () => {
    const committed = readFileSync(path.resolve(__dirname, "../docs/ASSUMPTIONS.md"), "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(renderAssumptionsDoc());
  });
});
