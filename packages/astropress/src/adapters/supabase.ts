import {
	type AstropressHostedApiAdapterOptions,
	createAstropressHostedApiAdapter,
} from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import type { AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
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

export function createAstropressSupabaseAdapter(
	options: AstropressSupabaseAdapterOptions = {},
) {
	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "supabase",
	});
}

export interface AstropressSupabaseHostedAdapterOptions
	extends AstropressSupabaseAdapterOptions {
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
		throw new Error(
			"Supabase hosted config requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
		);
	}

	return {
		url,
		serviceRoleKey,
		apiBaseUrl: `${url.replace(/\/$/, "")}/functions/v1/astropress`,
	};
}

export function createAstropressSupabaseHostedAdapter(
	options: AstropressSupabaseHostedAdapterOptions = {},
) {
	const config =
		options.config ?? readAstropressSupabaseHostedConfig(options.env);
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
			previewBaseUrl: `${config.url.replace(/\/$/, "")}/preview`,
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
					url: `${config.url.replace(/\/$/, "")}/preview`,
				};
			},
		},
	});
}
