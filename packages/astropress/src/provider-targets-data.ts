// stryker-disable-file: data-only
// Data-only sibling of provider-targets.ts. Mutating individual labels
// or capability flags is unkillable by reasonable tests — value is in
// the manifest shape, not specific provider copy. Behavior of the
// accessors is mutation-tested in provider-targets.ts at 95%+.

import { normalizeProviderCapabilities, type ProviderKind } from "./platform-contracts";
import type { FirstPartyProviderTarget } from "./provider-targets";

export const firstPartyProviderTargets: Record<ProviderKind, FirstPartyProviderTarget> = {
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
