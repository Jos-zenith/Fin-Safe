import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// The server keeps cases, sessions and notifications in a SQLite file. The test server gets its own fresh data
// directory, a fixed (test-only) session secret, and a 1-second notification poll so two-browser tests are quick.
const dataDir = path.join(tmpdir(), `fin-safe-e2e-${Date.now()}`);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: 0,
  // One worker: the demo accounts are shared on the server, so tests must not run side by side.
  workers: 1,
  use: { baseURL: "http://localhost:3100", viewport: { width: 412, height: 860 }, locale: "en-IN" },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATA_DIR: dataDir, SESSION_SECRET: "e2e-only-session-secret-not-for-real-use", POLL_MS: "1000", NODE_ENV: "production" },
  },
});
