/**
 * CmsConfig — the single seam between astropress and the host site.
 *
 * Call registerCms() once at startup (e.g. in src/site/cms-registration.ts imported by
 * middleware or the admin layout) before any astropress function is invoked.
 */
const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
function getConfigStore() {
    return globalThis;
}
export function registerCms(config) {
    getConfigStore()[CMS_CONFIG_KEY] = config;
}
export function getCmsConfig() {
    const config = getConfigStore()[CMS_CONFIG_KEY] ?? null;
    if (!config) {
        throw new Error("Astropress not initialized — call registerCms() before using astropress.");
    }
    return config;
}
export function peekCmsConfig() {
    return getConfigStore()[CMS_CONFIG_KEY] ?? null;
}
