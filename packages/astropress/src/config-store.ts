/**
 * config-store.ts — low-level global config storage.
 *
 * Extracted from config.ts so that plugin-dispatch.ts can read the config
 * without creating a circular dependency (config.ts re-exports from
 * plugin-dispatch.ts, and plugin-dispatch.ts needs peekCmsConfig).
 */
import type { CmsConfig } from "./config.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

type AstropressGlobalWithConfig = typeof globalThis & {
	[CMS_CONFIG_KEY]?: CmsConfig | null;
};

function getConfigStore(): AstropressGlobalWithConfig {
	return globalThis as AstropressGlobalWithConfig;
}

export function setStoreConfig(config: CmsConfig): void {
	getConfigStore()[CMS_CONFIG_KEY] = config;
}

export function peekCmsConfig(): CmsConfig | null {
	return getConfigStore()[CMS_CONFIG_KEY] ?? null;
}

export function getCmsConfigOrThrow(): CmsConfig {
	const config = getConfigStore()[CMS_CONFIG_KEY] ?? null;
	if (!config) {
		throw new Error(
			"Astropress not initialized — call registerCms() before using astropress.",
		);
	}
	return config;
}
