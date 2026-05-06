import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stripTrailingSlashes } from "../path-helpers";

export interface AstropressPreparedDeploymentOptions {
	provider: string;
	outputDir?: string;
	baseUrl?: string;
}

export async function prepareAstropressDeployment(
	input: {
		buildDir: string;
		projectName: string;
		environment?: string;
	},
	options: AstropressPreparedDeploymentOptions,
) {
	const baseOutputDir = resolve(
		options.outputDir ??
			join(
				input.buildDir,
				"..",
				".astropress",
				"deployments",
				options.provider,
			),
	);
	const targetDir = join(baseOutputDir, input.projectName);
	await rm(targetDir, { recursive: true, force: true });
	await mkdir(dirname(targetDir), { recursive: true });
	await cp(input.buildDir, targetDir, { recursive: true });

	const metadata = {
		provider: options.provider,
		projectName: input.projectName,
		preparedAt: new Date().toISOString(),
		environment: input.environment ?? "production",
	};
	await writeFile(
		join(targetDir, ".astropress-deploy.json"),
		`${JSON.stringify(metadata, null, 2)}\n`,
	);

	let url: string | undefined;
	if (options.baseUrl) {
		const trimmed = stripTrailingSlashes(options.baseUrl);
		url = `${trimmed}/${input.projectName}/`;
	}

	return {
		deploymentId: `${options.provider}:${input.projectName}:${Date.now()}`,
		url,
	};
}
