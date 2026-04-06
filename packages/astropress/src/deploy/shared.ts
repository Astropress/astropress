import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
    options.outputDir ?? join(input.buildDir, "..", ".astropress", "deployments", options.provider),
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
  await writeFile(join(targetDir, ".astropress-deploy.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    deploymentId: `${options.provider}:${input.projectName}:${Date.now()}`,
    url: options.baseUrl ? `${options.baseUrl.replace(/\/+$/, "")}/${input.projectName}/` : undefined,
  };
}
