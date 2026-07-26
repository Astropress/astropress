// stryker-disable-file: data-only — thin middleware entrypoint: `onRequest =
// createAstropressAdminSessionMiddleware()` takes no args and has no branches to
// mutate; the factory itself is mutation-tested in admin-session-middleware.ts.
import { createAstropressAdminSessionMiddleware } from "./admin-session-middleware.js";

// Auto-injected by createAstropressAdminAppIntegration (order: "pre") so that
// admin page guards see the signed-in user resolved from the session cookie.
export const onRequest = createAstropressAdminSessionMiddleware();
