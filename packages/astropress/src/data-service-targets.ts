import { dataServiceTargets } from "./data-service-targets-data";

export type AstropressDataServices =
	| "none"
	| "cloudflare"
	| "supabase"
	| "appwrite"
	| "pocketbase"
	| "neon"
	| "nhost"
	| "turso"
	| "custom";

export interface AstropressDataServiceTarget {
	id: AstropressDataServices;
	label: string;
	kind:
		| "none"
		| "full-stack-services"
		| "db-and-storage"
		| "database-only"
		| "app-platform"
		| "custom";
	providesDatabase: boolean;
	providesObjectStorage: boolean;
	providesAuth: boolean;
	notes: string;
}

export function listAstropressDataServiceTargets(): AstropressDataServiceTarget[] {
	return Object.values(dataServiceTargets);
}

export function getAstropressDataServiceTarget(
	dataServices: AstropressDataServices,
): AstropressDataServiceTarget {
	return dataServiceTargets[dataServices];
}
