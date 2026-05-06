import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";
import { deploymentMatrixEntries } from "./deployment-matrix-data";

export type AstropressDeploymentSupportLevel = "supported" | "preview" | "unsupported";

export interface AstropressDeploymentProfile {
	appHost: AstropressAppHost;
	dataServices: AstropressDataServices;
}

export interface AstropressDeploymentMatrixEntry extends AstropressDeploymentProfile {
	supportLevel: AstropressDeploymentSupportLevel;
	notes: string;
	requiredEnvKeys: string[];
}

export function listAstropressDeploymentMatrixEntries(): AstropressDeploymentMatrixEntry[] {
	return deploymentMatrixEntries.slice();
}

export function getAstropressDeploymentMatrixEntry(
	profile: AstropressDeploymentProfile,
): AstropressDeploymentMatrixEntry | null {
	return (
		deploymentMatrixEntries.find(
			(entry) => entry.appHost === profile.appHost && entry.dataServices === profile.dataServices,
		) ?? null
	);
}

export function resolveAstropressDeploymentSupportLevel(
	profile: AstropressDeploymentProfile,
): AstropressDeploymentSupportLevel {
	return getAstropressDeploymentMatrixEntry(profile)?.supportLevel ?? "unsupported";
}
