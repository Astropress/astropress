import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { resolveAstropressProjectEnvContract } from "./project-env.js";

function requiredEnvKeysForContentServices(contentServices) {
  switch (contentServices) {
    case "cloudflare":
      return ["ASTROPRESS_SERVICE_ORIGIN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"];
    case "supabase":
      return ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    case "firebase":
      return ["ASTROPRESS_SERVICE_ORIGIN", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
    case "appwrite":
      return ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"];
    case "pocketbase":
      return ["ASTROPRESS_SERVICE_ORIGIN", "POCKETBASE_URL", "POCKETBASE_EMAIL", "POCKETBASE_PASSWORD"];
    case "runway":
      return ["ASTROPRESS_SERVICE_ORIGIN", "RUNWAY_API_TOKEN", "RUNWAY_PROJECT_ID"];
    default:
      return [];
  }
}

function createOperationReport(contentServices, env, manifestFile) {
  const contract = resolveAstropressProjectEnvContract(env);
  const requiredEnvKeys = requiredEnvKeysForContentServices(contentServices);
  const missingEnvKeys = requiredEnvKeys.filter((key) => !env[key]?.trim());
  return {
    contentServices,
    supportLevel: contentServices === "none"
      ? "static"
      : missingEnvKeys.length === 0
        ? "configured"
        : "missing-config",
    serviceOrigin: contract.serviceOrigin,
    requiredEnvKeys,
    missingEnvKeys,
    manifestFile,
  };
}

export async function bootstrapAstropressContentServices(input) {
  const env = input.env ?? process.env;
  const contract = resolveAstropressProjectEnvContract(env);
  const workspaceRoot = resolve(input.workspaceRoot);
  const manifestFile = join(workspaceRoot, ".astropress", "services", `${contract.contentServices}.json`);
  await mkdir(dirname(manifestFile), { recursive: true });
  const report = createOperationReport(contract.contentServices, env, manifestFile);
  const manifest = {
    generatedAt: new Date().toISOString(),
    contentServices: contract.contentServices,
    serviceOrigin: contract.serviceOrigin,
    requiredEnvKeys: report.requiredEnvKeys,
    missingEnvKeys: report.missingEnvKeys,
    status: report.supportLevel,
  };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return report;
}

export async function verifyAstropressContentServices(input) {
  const env = input.env ?? process.env;
  const contract = resolveAstropressProjectEnvContract(env);
  const workspaceRoot = resolve(input.workspaceRoot);
  const manifestFile = join(workspaceRoot, ".astropress", "services", `${contract.contentServices}.json`);
  try {
    await readFile(manifestFile, "utf8");
    return createOperationReport(contract.contentServices, env, manifestFile);
  } catch {
    return createOperationReport(contract.contentServices, env);
  }
}
