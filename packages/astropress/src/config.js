/**
 * Validate metadata values against the field definitions for a given content type.
 * Returns null when all validations pass, or the first validation error message.
 * @param {import("./config.ts").ContentTypeDefinition} contentType
 * @param {Record<string, unknown>} metadata
 * @returns {string | null}
 */
export function validateContentFields(contentType, metadata) {
    for (const field of contentType.fields) {
        const value = metadata[field.name];
        const isEmpty = value === undefined || value === null || value === "";
        if (field.required && isEmpty) {
            return `"${field.label}" is required.`;
        }
        if (!isEmpty && typeof field.validate === "function") {
            const result = field.validate(value);
            if (result !== true && result) {
                return result;
            }
        }
    }
    return null;
}

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

/**
 * Dispatch a content lifecycle event to all registered plugin hooks.
 * Errors thrown by plugin hooks are caught and logged; they never fail the action.
 */
export async function dispatchPluginContentEvent(hook, event) {
    const config = peekCmsConfig();
    if (!config?.plugins?.length) return;
    for (const plugin of config.plugins) {
        const fn = plugin[hook];
        if (typeof fn !== "function") continue;
        try {
            await fn(event);
        } catch (err) {
            // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
            console.error(`[astropress] Plugin "${plugin.name}" threw in ${hook}:`, err);
        }
    }
}

/**
 * Dispatch a media upload event to all registered plugin hooks.
 * Errors thrown by plugin hooks are caught and logged; they never fail the upload action.
 */
export async function dispatchPluginMediaEvent(event) {
    const config = peekCmsConfig();
    if (!config?.plugins?.length) return;
    for (const plugin of config.plugins) {
        const fn = plugin.onMediaUpload;
        if (typeof fn !== "function") continue;
        try {
            await fn(event);
        } catch (err) {
            // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
            console.error(`[astropress] Plugin "${plugin.name}" threw in onMediaUpload:`, err);
        }
    }
}
