/**
 * Registry for optional headless service integrations (CMS, commerce, community, email).
 * Services registered here appear in the /ap-admin/services tab with an embedded iframe.
 *
 * @example
 * ```ts
 * import { registerAstropressService } from "astropress/services-config";
 *
 * registerAstropressService({
 *   provider: "cms",
 *   label: "Payload CMS",
 *   description: "Open-source TypeScript CMS — MIT licensed.",
 *   proxyTarget: "http://localhost:3000",
 *   adminPath: "/ap-admin/services/cms",
 * });
 * ```
 */

export type ServiceProvider = "cms" | "shop" | "community" | "email" | "testimonials";

export type AstropressServiceConfig = {
  /** Identifier for this service category. One of the four supported providers. */
  provider: ServiceProvider;
  /** Human-readable label shown in the Services tab. */
  label: string;
  /** Short description shown on the service card. */
  description: string;
  /**
   * Dev server proxy target (e.g. "http://localhost:3000").
   * The Vite / nginx proxy routes /ap-admin/services/<provider>/ → proxyTarget/.
   */
  proxyTarget: string;
  /** Admin path for this service within ap-admin, e.g. /ap-admin/services/cms */
  adminPath: string;
};

const registeredServices: AstropressServiceConfig[] = [];

/**
 * Register (or replace) an optional service integration.
 * Call this in your Astro config / integration setup file.
 */
export function registerAstropressService(config: AstropressServiceConfig): void {
  const existing = registeredServices.findIndex((s) => s.provider === config.provider);
  if (existing >= 0) {
    registeredServices[existing] = config;
  } else {
    registeredServices.push(config);
  }
}

/** Return all currently registered services in registration order. */
export function getAstropressServices(): AstropressServiceConfig[] {
  return [...registeredServices];
}

/** Look up a single service by provider key. Returns undefined if not registered. */
export function getAstropressService(provider: ServiceProvider): AstropressServiceConfig | undefined {
  return registeredServices.find((s) => s.provider === provider);
}

/** Remove a registered service (useful in tests). */
export function unregisterAstropressService(provider: ServiceProvider): void {
  const idx = registeredServices.findIndex((s) => s.provider === provider);
  if (idx >= 0) registeredServices.splice(idx, 1);
}

/** Remove all registered services (useful in tests). */
export function clearAstropressServices(): void {
  registeredServices.length = 0;
}

/**
 * Register the testimonials service if a URL is configured.
 * When `config.url` is set, the tool's admin panel is embedded as an iframe
 * in /ap-admin/services/testimonials. Has no effect when `url` is absent.
 */
export function registerTestimonialsServiceIfConfigured(config: { type: string; url?: string; label?: string }): void {
  if (!config.url) return;
  registerAstropressService({
    provider: "testimonials",
    label: config.label ?? (config.type === "typebot" ? "Typebot" : "Formbricks"),
    description: config.type === "typebot"
      ? "Conversational testimonial and referral capture flows."
      : "Survey and testimonial collection with referral support.",
    proxyTarget: config.url,
    adminPath: "/ap-admin/services/testimonials",
  });
}
