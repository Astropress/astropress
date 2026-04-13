import { randomUUID } from "node:crypto";
import type { JobEntry } from "./types.js";

const store = new Map<string, JobEntry>();

export function createJob(siteId: string, kind: JobEntry["kind"]): JobEntry {
  const entry: JobEntry = {
    id: randomUUID(),
    siteId,
    kind,
    status: "queued",
    queuedAt: new Date().toISOString(),
  };
  store.set(entry.id, entry);
  return entry;
}

export function getJob(id: string): JobEntry | undefined {
  return store.get(id);
}

export function listJobs(limit = 50, offset = 0): { jobs: JobEntry[]; total: number } {
  const all = [...store.values()].sort(
    (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime(),
  );
  return { jobs: all.slice(offset, offset + limit), total: all.length };
}

export function updateJob(id: string, patch: Partial<JobEntry>): void {
  const entry = store.get(id);
  if (entry) store.set(id, { ...entry, ...patch });
}

/** Clear all jobs — used by tests to reset state between runs. */
export function _clearJobsForTest(): void {
  store.clear();
}
