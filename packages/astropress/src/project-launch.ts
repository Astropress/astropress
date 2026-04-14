import {
  createAstropressProjectRuntimePlan,
  type AstropressProjectRuntimeOptions,
  type AstropressProjectRuntimePlan,
} from "./project-runtime";
import {
  recommendAstropressProvider,
  type AstropressExistingPlatform,
  type AstropressProviderChoiceRecommendation,
} from "./provider-choice";

export interface AstropressProjectLaunchPlan {
  runtime: AstropressProjectRuntimePlan;
  provider: string;
  deployTarget: string;
  appHost: string;
  dataServices: string;
  adminDbPath: string;
  requiresLocalSeed: boolean;
  recommendation: AstropressProviderChoiceRecommendation;
}

export interface AstropressProjectLaunchOptions extends AstropressProjectRuntimeOptions {}

function resolveExistingPlatform(dataServices: string): AstropressExistingPlatform {
  if (
    dataServices === "cloudflare" ||
    dataServices === "supabase" ||
    dataServices === "appwrite"
  ) {
    return dataServices;
  }
  return "none";
}

export function createAstropressProjectLaunchPlan(
  options: AstropressProjectLaunchOptions = {},
): AstropressProjectLaunchPlan {
  const runtime = createAstropressProjectRuntimePlan(options);
  const provider = runtime.mode === "hosted" ? runtime.env.hostedProvider : runtime.env.localProvider;
  return {
    runtime,
    provider,
    deployTarget: runtime.env.deployTarget,
    appHost: runtime.env.appHost,
    dataServices: runtime.env.dataServices,
    adminDbPath: runtime.env.adminDbPath,
    requiresLocalSeed: runtime.mode === "local",
    recommendation: recommendAstropressProvider({
      existingPlatform: resolveExistingPlatform(runtime.env.dataServices),
      wantsStaticMirror: runtime.env.appHost === "github-pages" || runtime.env.appHost === "gitlab-pages",
      wantsHostedAdmin: runtime.env.dataServices !== "none",
    }),
  };
}
