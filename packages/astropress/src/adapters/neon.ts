/**
 * Neon adapter stub for Astropress.
 *
 * Neon is a database-only provider — it does not include object storage or
 * auth services. A full Neon adapter requires pairing Neon with a storage
 * service (e.g. Cloudflare R2, AWS S3) and an auth service.
 *
 * This stub is intentionally not implemented. It exists so that consumers
 * who select "neon" in `astropress new` receive a clear error at runtime
 * rather than a confusing module-not-found failure.
 *
 * To use Neon with Astropress today:
 * 1. Set up a Neon Postgres database and obtain a connection string.
 * 2. Implement `AstropressPlatformAdapter` using `@neondatabase/serverless`.
 * 3. Register your adapter in `local-runtime-modules.ts`.
 *
 * See: https://neon.tech/docs/serverless/serverless-driver
 */

import type { AstropressPlatformAdapter } from "../platform-contracts.js";

export function createAstropressNeonAdapter(): AstropressPlatformAdapter {
  throw new Error(
    "[astropress] The Neon adapter is not yet implemented. " +
    "Neon is a database-only provider that requires pairing with a storage and auth service. " +
    "Implement AstropressPlatformAdapter directly using @neondatabase/serverless, " +
    "or choose a full-stack provider (cloudflare, supabase, appwrite) instead.",
  );
}
