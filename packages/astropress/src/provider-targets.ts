import {
	type ProviderCapabilities,
	type ProviderKind,
	normalizeProviderCapabilities,
} from "./platform-contracts";

export type FirstPartyProviderTarget = {
	id: ProviderKind;
	label: string;
	runtime: "static" | "edge" | "managed-db" | "app-platform";
	canonicalDeploySurface: string;
	adminSurface: "astropress" | "provider-managed";
	capabilities: ProviderCapabilities;
};

const firstPartyProviderTargets: Record<
	ProviderKind,
	FirstPartyProviderTarget
> = {
	"github-pages": {
		id: "github-pages",
		label: "GitHub Pages",
		runtime: "static",
		canonicalDeploySurface: "github-pages",
		adminSurface: "astropress",
		capabilities: normalizeProviderCapabilities({
			name: "github-pages",
			staticPublishing: true,
			hostedAdmin: false,
			previewEnvironments: true,
			serverRuntime: false,
			database: false,
			objectStorage: false,
			gitSync: true,
		}),
	},
	cloudflare: {
		id: "cloudflare",
		label: "Cloudflare",
		runtime: "edge",
		canonicalDeploySurface: "cloudflare-pages-workers",
		adminSurface: "astropress",
		capabilities: normalizeProviderCapabilities({
			name: "cloudflare",
			staticPublishing: true,
			hostedAdmin: true,
			previewEnvironments: true,
			serverRuntime: true,
			database: true,
			objectStorage: true,
			gitSync: true,
		}),
	},
	supabase: {
		id: "supabase",
		label: "Supabase",
		runtime: "managed-db",
		canonicalDeploySurface: "supabase-plus-astro-host",
		adminSurface: "astropress",
		capabilities: normalizeProviderCapabilities({
			name: "supabase",
			staticPublishing: false,
			hostedAdmin: true,
			previewEnvironments: false,
			serverRuntime: true,
			database: true,
			objectStorage: true,
			gitSync: true,
		}),
	},
	custom: {
		id: "custom",
		label: "Custom Adapter",
		runtime: "app-platform",
		canonicalDeploySurface: "custom",
		adminSurface: "astropress",
		capabilities: normalizeProviderCapabilities({
			name: "custom",
		}),
	},
};

export function listFirstPartyProviderTargets(): FirstPartyProviderTarget[] {
	return Object.values(firstPartyProviderTargets);
}

export function getFirstPartyProviderTarget(
	provider: ProviderKind,
): FirstPartyProviderTarget {
	return firstPartyProviderTargets[provider];
}
