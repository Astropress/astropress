/**
 * Nhost adapter stub for Astropress.
 *
 * Nhost provides a full-stack backend (Postgres via Hasura, Auth, Storage).
 * A first-party Nhost adapter is on the roadmap but has not yet been implemented.
 *
 * This stub is intentionally not implemented. It exists so that consumers
 * who select "nhost" in `astropress new` receive a clear error at runtime
 * rather than a confusing module-not-found failure.
 *
 * To use Nhost with Astropress today:
 * 1. Set up an Nhost project and obtain your subdomain and region.
 * 2. Implement `AstropressPlatformAdapter` using `@nhost/nhost-js`.
 * 3. Register your adapter in `local-runtime-modules.ts`.
 *
 * See: https://docs.nhost.io/reference/javascript
 */

import type { AstropressPlatformAdapter } from "../platform-contracts.js";

export function createAstropressNhostAdapter(): AstropressPlatformAdapter {
  throw new Error(
    "[astropress] The Nhost adapter is not yet implemented. " +
    "Implement AstropressPlatformAdapter directly using @nhost/nhost-js, " +
    "or choose an already-supported provider (cloudflare, supabase, appwrite) instead.",
  );
}
