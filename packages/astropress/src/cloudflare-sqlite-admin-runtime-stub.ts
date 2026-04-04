function unavailable(): never {
  throw new Error(
    "The Node SQLite admin runtime is unavailable in the Cloudflare build. Use the Cloudflare/D1 runtime instead.",
  );
}

export function createAstropressSqliteAdminRuntime() {
  unavailable();
}
