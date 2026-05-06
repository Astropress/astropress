import {
	type AstropressHostedApiAdapterOptions,
	createAstropressHostedApiAdapter,
} from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import type { AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { stripTrailingSlashes } from "../path-helpers";
import type { AstropressPlatformAdapter } from "../platform-contracts";
import { FULL_STACK_CAPABILITIES } from "./adapter-record-helpers";

export interface AstropressSupabaseHostedConfig {
	url: string;
	serviceRoleKey: string;
	apiBaseUrl: string;
}

export type AstropressSupabaseAdapterOptions = Omit<
	AstropressInMemoryPlatformAdapterOptions,
	"capabilities"
> & {
	backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressSupabaseAdapter(options: AstropressSupabaseAdapterOptions = {}) {
	// Reject the misconfiguration that previously routed silently to the
	// in-memory fallback. Callers must supply a real backingAdapter, or at
	// least one of the granular stores (auth/content/media/revisions); the
	// in-memory fallback is a footgun in production and was only catchable
	// by asserting on the seed user id.
	if (
		!options.backingAdapter &&
		!options.auth &&
		!options.content &&
		!options.media &&
		!options.revisions
	) {
		throw new Error(
			"createAstropressSupabaseAdapter requires backingAdapter or one of auth/content/media/revisions. Pass a real adapter (e.g. createAstropressSqliteAdapter) or use createAstropressSupabaseSqliteAdapter.",
		);
	}
	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "supabase",
	});
}

export interface AstropressSupabaseHostedAdapterOptions extends AstropressSupabaseAdapterOptions {
	config?: AstropressSupabaseHostedConfig;
	env?: Record<string, string | undefined>;
	fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressSupabaseHostedConfig(
	env: Record<string, string | undefined> = process.env,
): AstropressSupabaseHostedConfig {
	const url = env.SUPABASE_URL?.trim();
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

	if (!url || !serviceRoleKey) {
		throw new Error("Supabase hosted config requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
	}

	return {
		url,
		serviceRoleKey,
		apiBaseUrl: `${stripTrailingSlashes(url)}/functions/v1/astropress`,
	};
}

export function createAstropressSupabaseHostedAdapter(
	options: AstropressSupabaseHostedAdapterOptions = {},
) {
	const config = options.config ?? readAstropressSupabaseHostedConfig(options.env);
	if (
		!options.backingAdapter &&
		!options.content &&
		!options.media &&
		!options.revisions &&
		!options.auth
	) {
		return createAstropressHostedApiAdapter({
			providerName: "supabase",
			apiBaseUrl: config.apiBaseUrl,
			accessToken: config.serviceRoleKey,
			previewBaseUrl: `${stripTrailingSlashes(config.url)}/preview`,
			fetchImpl: options.fetchImpl,
			defaultCapabilities: {
				...options.defaultCapabilities,
				...FULL_STACK_CAPABILITIES,
			},
		});
	}
	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "supabase",
		defaultCapabilities: {
			...options.defaultCapabilities,
			...FULL_STACK_CAPABILITIES,
		},
		preview: options.preview ?? {
			async create() {
				return {
					url: `${stripTrailingSlashes(config.url)}/preview`,
				};
			},
		},
	});
}
