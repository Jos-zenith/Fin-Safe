import path from "node:path";
import { defineConfig } from "vitest/config";

// An ES module (.mts): Vitest 5 loads its config natively, and this package is CommonJS.
//
// WORKAROUND, root cause not found: with Vitest 5.1.1 on Windows with Node 22.17 the DEFAULT worker pool fails every test
// file with "Vitest failed to find the runner" (reproduced with a one-line test and a minimal config), while the VM pools
// run all of them. "vmForks" is used: each file runs in its own context inside a child process. Cost: slower start and the
// usual VM-pool caveats (see the Vitest docs). Re-check the default pool when Vitest or Node is upgraded again.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // testTimeout: the default 5s is too short for the corpus evaluations and the 300-profile property tests when the whole
  // suite runs in parallel on a slow machine (they pass in isolation in about 10s). A real hang still fails, just later.
  test: { environment: "node", include: ["tests/**/*.test.ts"], pool: "vmForks", testTimeout: 60_000 },
});
