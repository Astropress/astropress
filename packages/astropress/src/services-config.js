/**
 * Registry for optional headless service integrations (CMS, commerce, community, email).
 * JS mirror of services-config.ts — logic must stay in sync.
 */

const registeredServices = [];

export function registerAstropressService(config) {
  const existing = registeredServices.findIndex((s) => s.provider === config.provider);
  if (existing >= 0) {
    registeredServices[existing] = config;
  } else {
    registeredServices.push(config);
  }
}

export function getAstropressServices() {
  return [...registeredServices];
}

export function getAstropressService(provider) {
  return registeredServices.find((s) => s.provider === provider);
}

export function unregisterAstropressService(provider) {
  const idx = registeredServices.findIndex((s) => s.provider === provider);
  if (idx >= 0) registeredServices.splice(idx, 1);
}

export function clearAstropressServices() {
  registeredServices.length = 0;
}
