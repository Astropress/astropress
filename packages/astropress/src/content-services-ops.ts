import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { resolveAstropressProjectEnvContract } from "./project-env.js";

export interface AstropressContentServicesBootstrapInput {
  workspaceRoot: string;
  env?: Record<string, string | undefined>;
}

export interface AstropressContentServicesVerifyInput {
  workspaceRoot: string;
  env?: Record<string, string | undefined>;
}

export interface AstropressContentServicesOperationReport {
  contentServices: string;
  supportLevel: "configured" | "missing-config" | "static";
  serviceOrigin: string | null;
  requiredEnvKeys: string[];
  missingEnvKeys: string[];
  manifestFile?: string;
}

function requiredEnvKeysForContentServices(contentServices: string) {
  switch (contentServices) {
    case "cloudflare":
      return ["ASTROPRESS_SERVICE_ORIGIN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"];
    case "supabase":
      return ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    case "appwrite":
      return ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"];
    case "pocketbase":
      return ["ASTROPRESS_SERVICE_ORIGIN", "POCKETBASE_URL", "POCKETBASE_EMAIL", "POCKETBASE_PASSWORD"];
    case "nhost":
      return ["ASTROPRESS_SERVICE_ORIGIN", "NHOST_SUBDOMAIN", "NHOST_REGION", "NHOST_ADMIN_SECRET"];
    case "neon":
      return ["ASTROPRESS_SERVICE_ORIGIN", "NEON_DATABASE_URL"];
    case "turso":
      return ["ASTROPRESS_SERVICE_ORIGIN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
    default:
      return [];
  }
}

function missingEnvKeysForContentServices(
  contentServices: string,
  env: Record<string, string | undefined>,
  requiredEnvKeys: string[],
): string[] {
  if (contentServices !== "neon") {
    return requiredEnvKeys.filter((key) => !env[key]?.trim());
  }

  return requiredEnvKeys.filter((key) => {
    if (key !== "NEON_DATABASE_URL") {
      return !env[key]?.trim();
    }
    return !(env.NEON_DATABASE_URL?.trim() || env.DATABASE_URL?.trim());
  });
}

function createOperationReport(
  contentServices: string,
  env: Record<string, string | undefined>,
  manifestFile?: string,
): AstropressContentServicesOperationReport {
  const contract = resolveAstropressProjectEnvContract(env);
  const requiredEnvKeys = requiredEnvKeysForContentServices(contentServices);
  const missingEnvKeys = missingEnvKeysForContentServices(contentServices, env, requiredEnvKeys);
  return {
    contentServices,
    supportLevel:
      contentServices === "none"
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

export async function bootstrapAstropressContentServices(
  input: AstropressContentServicesBootstrapInput,
): Promise<AstropressContentServicesOperationReport> {
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

export async function verifyAstropressContentServices(
  input: AstropressContentServicesVerifyInput,
): Promise<AstropressContentServicesOperationReport> {
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
