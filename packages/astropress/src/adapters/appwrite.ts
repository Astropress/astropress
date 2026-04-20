import {
	type AstropressHostedApiAdapterOptions,
	createAstropressHostedApiAdapter,
} from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import type { AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import type { AstropressPlatformAdapter } from "../platform-contracts";
import { FULL_STACK_CAPABILITIES } from "./adapter-record-helpers";

export interface AstropressAppwriteHostedConfig {
	endpoint: string;
	projectId: string;
	apiKey: string;
	databaseId?: string;
	bucketId?: string;
	apiBaseUrl: string;
	previewBaseUrl: string;
}

export type AstropressAppwriteAdapterOptions = Omit<
	AstropressInMemoryPlatformAdapterOptions,
	"capabilities"
> & {
	backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressAppwriteAdapter(
	options: AstropressAppwriteAdapterOptions = {},
) {
	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "appwrite",
		defaultCapabilities: {
			...options.defaultCapabilities,
			...FULL_STACK_CAPABILITIES,
			hostPanel: options.defaultCapabilities?.hostPanel ?? {
				mode: "link",
				url: "https://cloud.appwrite.io",
				label: "Appwrite Console",
			},
		},
	});
}

export interface AstropressAppwriteHostedAdapterOptions
	extends AstropressAppwriteAdapterOptions {
	config?: AstropressAppwriteHostedConfig;
	env?: Record<string, string | undefined>;
	fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressAppwriteHostedConfig(
	env: Record<string, string | undefined> = process.env,
): AstropressAppwriteHostedConfig {
	const endpoint = env.APPWRITE_ENDPOINT?.trim();
	const projectId = env.APPWRITE_PROJECT_ID?.trim();
	const apiKey = env.APPWRITE_API_KEY?.trim();

	if (!endpoint || !projectId || !apiKey) {
		throw new Error(
			"Appwrite hosted config requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.",
		);
	}

	const base = endpoint.replace(/\/$/, "");
	const databaseId = env.APPWRITE_DATABASE_ID?.trim();
	const bucketId = env.APPWRITE_BUCKET_ID?.trim();
	return {
		endpoint,
		projectId,
		apiKey,
		...(databaseId && { databaseId }),
		...(bucketId && { bucketId }),
		apiBaseUrl: `${base}/functions/astropress`,
		previewBaseUrl: `${base}/console/project-${projectId}`,
	};
}

export function createAstropressAppwriteHostedAdapter(
	options: AstropressAppwriteHostedAdapterOptions = {},
) {
	const config =
		options.config ?? readAstropressAppwriteHostedConfig(options.env);
	const hostPanel = options.defaultCapabilities?.hostPanel ?? {
		mode: "link" as const,
		url: `https://cloud.appwrite.io/console/project-${config.projectId}`,
		label: "Appwrite Console",
	};

	if (
		!options.backingAdapter &&
		!options.content &&
		!options.media &&
		!options.revisions &&
		!options.auth
	) {
		return createAstropressHostedApiAdapter({
			providerName: "appwrite",
			apiBaseUrl: config.apiBaseUrl,
			accessToken: config.apiKey,
			previewBaseUrl: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`,
			fetchImpl: options.fetchImpl,
			defaultCapabilities: {
				...options.defaultCapabilities,
				...FULL_STACK_CAPABILITIES,
				hostPanel,
			},
		});
	}

	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "appwrite",
		defaultCapabilities: {
			...options.defaultCapabilities,
			...FULL_STACK_CAPABILITIES,
			hostPanel,
		},
		preview: options.preview ?? {
			async create() {
				return {
					url: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`,
				};
			},
		},
	});
}
