// The one place that decides which CaseStore the server uses. Swap this for a Postgres implementation later.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../config";
import { SqliteCaseStore } from "./sqlite";
import type { CaseStore } from "./types";

const g = globalThis as unknown as { __finSafeStore?: CaseStore };

export function getStore(): CaseStore {
  if (!g.__finSafeStore) {
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    g.__finSafeStore = new SqliteCaseStore(path.join(dir, "demo.sqlite"));
  }
  return g.__finSafeStore;
}

/** Tests install an in-memory store here, and pass null to go back to the file-backed one. */
export function setStoreForTests(store: CaseStore | null): void {
  g.__finSafeStore = store ?? undefined;
}

export const newMemoryStore = (): SqliteCaseStore => new SqliteCaseStore(":memory:");
