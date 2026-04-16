import { createAstropressSecurityMiddleware } from "./security-middleware.js";

// In Vite dev mode, Astro injects scoped component styles as inline <style> blocks.
// Allow them so the admin UI renders correctly during local development.
// Production builds extract all styles to external files, so this flag is false there.
export const onRequest = createAstropressSecurityMiddleware({
  allowInlineStyles: import.meta.env.DEV,
});
