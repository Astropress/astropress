import { createAstropressAdminSessionMiddleware } from "./admin-session-middleware.js";

// Auto-injected by createAstropressAdminAppIntegration (order: "pre") so that
// admin page guards see the signed-in user resolved from the session cookie.
export const onRequest = createAstropressAdminSessionMiddleware();
