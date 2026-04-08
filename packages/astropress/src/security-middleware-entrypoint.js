import { createAstropressSecurityMiddleware } from "./security-middleware.js";

export const onRequest = createAstropressSecurityMiddleware();
