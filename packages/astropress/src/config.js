/**
 * CmsConfig — the single seam between AstroPress (src/cms/) and the host site (src/site/).
 *
 * Call registerCms() once at startup (e.g. in src/site/cms-registration.ts imported by
 * middleware or the admin layout) before any CMS function is invoked.
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
        throw new Error("CMS not initialized — call registerCms() before using the CMS.");
    }
    return config;
}
export function peekCmsConfig() {
    return getConfigStore()[CMS_CONFIG_KEY] ?? null;
}
