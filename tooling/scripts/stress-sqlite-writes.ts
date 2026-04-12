/**
 * SQLite concurrent-write stress test.
 *
 * Spawns N worker threads that each perform M INSERT operations against a
 * single shared SQLite file. Measures throughput, tracks SQLITE_BUSY
 * escalations, and reports WAL checkpoint behaviour.
 *
 * Usage:
 *   bun run stress:sqlite
 *   bun run stress:sqlite -- --concurrency=50 --writes=500
 *   bun run stress:sqlite -- --help
 *
 * Target: 100 concurrent writers × 1000 writes with zero SQLITE_BUSY errors.
 * Run once per release as a manual gate — not wired into per-commit CI.
 */

import { Worker, workerData, parentPort, isMainThread } from "node:worker_threads";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Worker thread: performs writes and reports results to the main thread
// ---------------------------------------------------------------------------

interface WorkerInput {
  dbPath: string;
  writes: number;
  workerId: number;
}

interface WorkerResult {
  workerId: number;
  succeeded: number;
  busyErrors: number;
  otherErrors: number;
  elapsedMs: number;
}

async function runWorker(input: WorkerInput): Promise<void> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(input.dbPath);

  // Enable WAL mode and a short busy timeout so contention is measured
  // rather than escalated to a hard error.
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA busy_timeout=5000"); // wait up to 5 s before BUSY

  const insert = db.prepare(
    "INSERT INTO stress_writes (worker_id, seq, payload, written_at) VALUES (?, ?, ?, ?)"
  );

  let succeeded = 0;
  let busyErrors = 0;
  let otherErrors = 0;

  const startMs = performance.now();

  for (let i = 0; i < input.writes; i++) {
    try {
      insert.run(
        input.workerId,
        i,
        `worker-${input.workerId}-seq-${i}-${"x".repeat(64)}`,
        new Date().toISOString()
      );
      succeeded++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("SQLITE_BUSY") || msg.includes("database is locked")) {
        busyErrors++;
      } else {
        otherErrors++;
      }
    }
  }

  const elapsedMs = performance.now() - startMs;

  db.close();

  const result: WorkerResult = {
    workerId: input.workerId,
    succeeded,
    busyErrors,
    otherErrors,
    elapsedMs,
  };
  parentPort!.postMessage(result);
}

if (!isMainThread) {
  runWorker(workerData as WorkerInput).catch((err) => {
    parentPort!.postMessage({ error: String(err) });
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Main thread: orchestrate workers and print report
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: bun run stress:sqlite [options]

Options:
  --concurrency=N    Number of concurrent writer threads (default: 100)
  --writes=N         Writes per thread (default: 1000)
  --db=PATH          SQLite file path (default: tmp file, deleted after run)
  --keep             Do not delete the database file after the run
  --help             Show this help
`.trim());
    process.exit(0);
  }

  const getArg = (flag: string, def: number): number => {
    const match = args.find((a) => a.startsWith(`--${flag}=`));
    return match ? parseInt(match.split("=")[1]!, 10) : def;
  };

  const concurrency = getArg("concurrency", 100);
  const writesPerWorker = getArg("writes", 1000);
  const keepDb = args.includes("--keep");

  const customDb = args.find((a) => a.startsWith("--db="))?.split("=")[1];
  const dbPath = customDb ?? join(tmpdir(), `astropress-stress-${Date.now()}.sqlite`);

  console.log(`\nAstropress SQLite Write Stress Test`);
  console.log(`  Concurrency : ${concurrency} workers`);
  console.log(`  Writes      : ${writesPerWorker} per worker (${concurrency * writesPerWorker} total)`);
  console.log(`  Database    : ${dbPath}`);
  console.log("");

  // Set up the database schema
  const { DatabaseSync } = await import("node:sqlite");
  const setupDb = new DatabaseSync(dbPath);
  setupDb.exec("PRAGMA journal_mode=WAL");
  setupDb.exec(`
    CREATE TABLE IF NOT EXISTS stress_writes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id  INTEGER NOT NULL,
      seq        INTEGER NOT NULL,
      payload    TEXT    NOT NULL,
      written_at TEXT    NOT NULL
    )
  `);
  setupDb.close();

  const totalStart = performance.now();
  const selfPath = fileURLToPath(import.meta.url);

  const results = await new Promise<WorkerResult[]>((resolve, reject) => {
    const collected: WorkerResult[] = [];
    let done = 0;

    for (let i = 0; i < concurrency; i++) {
      const workerInput: WorkerInput = { dbPath, writes: writesPerWorker, workerId: i };
      const worker = new Worker(selfPath, { workerData: workerInput });

      worker.on("message", (msg: WorkerResult | { error: string }) => {
        if ("error" in msg) {
          reject(new Error(`Worker ${i} failed: ${msg.error}`));
          return;
        }
        collected.push(msg);
        done++;
        if (done === concurrency) resolve(collected);
      });

      worker.on("error", (err) => reject(err));
    }
  });

  const totalElapsedMs = performance.now() - totalStart;

  // Aggregate results
  const totalSucceeded = results.reduce((a, r) => a + r.succeeded, 0);
  const totalBusy = results.reduce((a, r) => a + r.busyErrors, 0);
  const totalOther = results.reduce((a, r) => a + r.otherErrors, 0);
  const maxWorkerMs = Math.max(...results.map((r) => r.elapsedMs));
  const avgWorkerMs = results.reduce((a, r) => a + r.elapsedMs, 0) / results.length;

  const throughput = totalSucceeded / (totalElapsedMs / 1000);

  // Verify row count via main db
  const verifyDb = new DatabaseSync(dbPath);
  const rowCount = (verifyDb.prepare("SELECT COUNT(*) as n FROM stress_writes").get() as { n: number }).n;
  verifyDb.close();

  // Cleanup
  if (!keepDb && existsSync(dbPath)) {
    try {
      rmSync(dbPath);
      rmSync(dbPath + "-wal", { force: true });
      rmSync(dbPath + "-shm", { force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  // Report
  console.log(`Results`);
  console.log(`  Total writes attempted : ${concurrency * writesPerWorker}`);
  console.log(`  Succeeded              : ${totalSucceeded}`);
  console.log(`  Rows in database       : ${rowCount}`);
  console.log(`  SQLITE_BUSY errors     : ${totalBusy}`);
  console.log(`  Other errors           : ${totalOther}`);
  console.log(`  Wall-clock time        : ${totalElapsedMs.toFixed(0)} ms`);
  console.log(`  Throughput             : ${throughput.toFixed(0)} writes/sec`);
  console.log(`  Slowest worker         : ${maxWorkerMs.toFixed(0)} ms`);
  console.log(`  Avg worker time        : ${avgWorkerMs.toFixed(0)} ms`);

  const passed = totalBusy === 0 && totalOther === 0 && rowCount === concurrency * writesPerWorker;

  console.log("");
  if (passed) {
    console.log("PASS — zero SQLITE_BUSY escalations, all writes committed.");
  } else {
    console.log("FAIL");
    if (totalBusy > 0) console.log(`  ${totalBusy} SQLITE_BUSY errors detected — increase busy_timeout or reduce concurrency`);
    if (totalOther > 0) console.log(`  ${totalOther} unexpected errors`);
    if (rowCount !== concurrency * writesPerWorker) {
      console.log(`  Row count mismatch: expected ${concurrency * writesPerWorker}, got ${rowCount}`);
    }
    process.exit(1);
  }
}

if (isMainThread) {
  main().catch((err) => {
    console.error("Stress test failed:", err);
    process.exit(1);
  });
}
