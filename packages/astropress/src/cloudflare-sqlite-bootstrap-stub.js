function unavailable() {
  throw new Error(
    "The Node SQLite bootstrap toolkit is unavailable in the Cloudflare build. Use the Cloudflare/D1 runtime instead.",
  );
}

export function resolveAstropressSqliteSchemaPath() {
  unavailable();
}

export function readAstropressSqliteSchemaSql() {
  unavailable();
}

export function createDefaultAstropressSqliteSeedToolkit() {
  unavailable();
}
