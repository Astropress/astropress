import { appHostTargets } from "./app-host-targets-data";

export type AstropressAppHost =
	| "github-pages"
	| "cloudflare-pages"
	| "vercel"
	| "netlify"
	| "render-static"
	| "render-web"
	| "gitlab-pages"
	| "fly-io"
	| "coolify"
	| "digitalocean"
	| "railway"
	| "custom";

export interface AstropressAppHostTarget {
	id: AstropressAppHost;
	label: string;
	runtime:
		| "static"
		| "edge"
		| "serverless"
		| "web-service"
		| "app-platform"
		| "custom";
	supportsStatic: boolean;
	supportsServerRuntime: boolean;
	notes: string;
}

export function listAstropressAppHosts(): AstropressAppHostTarget[] {
	return Object.values(appHostTargets);
}

export function getAstropressAppHostTarget(
	appHost: AstropressAppHost,
): AstropressAppHostTarget {
	return appHostTargets[appHost];
}
