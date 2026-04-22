export type AstropressApiRouteDefinition = {
	pattern: string;
	entrypoint: string;
	methods: string[];
	scopes: string[];
	auth: boolean;
};

export type AstropressApiRouteInjector = (
	route: AstropressApiRouteDefinition,
) => void;

export const apiRouteDefinitions: AstropressApiRouteDefinition[] = [
	{
		pattern: "/ap-api/v1/content",
		entrypoint: "ap-api/v1/content.ts",
		methods: ["GET", "POST"],
		scopes: ["content:read", "content:write"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/content/[id]",
		entrypoint: "ap-api/v1/content/[id].ts",
		methods: ["GET", "PUT", "DELETE"],
		scopes: ["content:read", "content:write"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/media",
		entrypoint: "ap-api/v1/media.ts",
		methods: ["GET", "POST"],
		scopes: ["media:read", "media:write"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/media/[id]",
		entrypoint: "ap-api/v1/media/[id].ts",
		methods: ["DELETE"],
		scopes: ["media:write"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/revisions/[recordId]",
		entrypoint: "ap-api/v1/revisions/[recordId].ts",
		methods: ["GET"],
		scopes: ["content:read"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/settings",
		entrypoint: "ap-api/v1/settings.ts",
		methods: ["GET"],
		scopes: ["settings:read"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/webhooks",
		entrypoint: "ap-api/v1/webhooks.ts",
		methods: ["GET", "POST"],
		scopes: ["webhooks:manage"],
		auth: true,
	},
	{
		pattern: "/ap-api/v1/openapi.json",
		entrypoint: "ap-api/v1/openapi.json.ts",
		methods: ["GET"],
		scopes: [],
		auth: false,
	},
];

export function injectApiRoutes(injector: AstropressApiRouteInjector) {
	for (const route of apiRouteDefinitions) {
		injector(route);
	}
}
