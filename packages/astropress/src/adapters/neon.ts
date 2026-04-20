import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import type { AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import type { AstropressPlatformAdapter } from "../platform-contracts";

export interface AstropressNeonHostedConfig {
	databaseUrl: string;
	projectId?: string;
	apiBaseUrl: string;
}

export type AstropressNeonAdapterOptions = Omit<
	AstropressInMemoryPlatformAdapterOptions,
	"capabilities"
> & {
	backingAdapter?: AstropressPlatformAdapter;
};

/**
 * Creates a Neon adapter with database-only capabilities.
 *
 * Neon is a serverless Postgres database — it does not provide object storage,
 * a hosted admin panel, or a server runtime for Astropress functions. Pair Neon
 * with a static host (Vercel, Netlify) for the app and a storage service
 * (Cloudflare R2, AWS S3) for media uploads.
 */
export function createAstropressNeonAdapter(
	options: AstropressNeonAdapterOptions = {},
) {
	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "neon",
		defaultCapabilities: {
			hostedAdmin: false,
			previewEnvironments: false,
			serverRuntime: false,
			database: true,
			objectStorage: false,
			gitSync: false,
			...options.defaultCapabilities,
		},
	});
}

export interface AstropressNeonHostedAdapterOptions
	extends AstropressNeonAdapterOptions {
	config?: AstropressNeonHostedConfig;
	env?: Record<string, string | undefined>;
}

export function readAstropressNeonHostedConfig(
	env: Record<string, string | undefined> = process.env,
): AstropressNeonHostedConfig {
	const databaseUrl = env.NEON_DATABASE_URL?.trim() ?? env.DATABASE_URL?.trim();

	if (!databaseUrl) {
		throw new Error(
			"Neon hosted config requires NEON_DATABASE_URL or DATABASE_URL (your Neon connection string).",
		);
	}

	if (
		!databaseUrl.startsWith("postgres://") &&
		!databaseUrl.startsWith("postgresql://")
	) {
		throw new Error(
			"Neon DATABASE_URL must be a postgres:// or postgresql:// connection string.",
		);
	}

	const projectId = env.NEON_PROJECT_ID?.trim();

	return {
		databaseUrl,
		...(projectId && { projectId }),
		apiBaseUrl: projectId
			? `https://console.neon.tech/app/projects/${projectId}`
			: "https://console.neon.tech",
	};
}

export function createAstropressNeonHostedAdapter(
	options: AstropressNeonHostedAdapterOptions = {},
) {
	const config = options.config ?? readAstropressNeonHostedConfig(options.env);

	return createAstropressHostedPlatformAdapter({
		...options,
		providerName: "neon",
		defaultCapabilities: {
			...options.defaultCapabilities,
			hostedAdmin: false,
			previewEnvironments: false,
			serverRuntime: false,
			database: true,
			objectStorage: false,
			gitSync: false,
			hostPanel: options.defaultCapabilities?.hostPanel ?? {
				mode: "link",
				url: config.apiBaseUrl,
				label: "Neon Console",
			},
		},
	});
}
