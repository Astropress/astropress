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
  adminDbPath: string;
  requiresLocalSeed: boolean;
  recommendation: AstropressProviderChoiceRecommendation;
}

export interface AstropressProjectLaunchOptions extends AstropressProjectRuntimeOptions {}

function resolveExistingPlatform(provider: string, mode: "local" | "hosted"): AstropressExistingPlatform {
  if (provider === "supabase") {
    return "supabase";
  }
  if (provider === "runway") {
    return "runway";
  }
  if (mode === "hosted" && provider === "cloudflare") {
    return "cloudflare";
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
    adminDbPath: runtime.env.adminDbPath,
    requiresLocalSeed: runtime.mode === "local",
    recommendation: recommendAstropressProvider({
      existingPlatform: resolveExistingPlatform(provider, runtime.mode),
      wantsStaticMirror: runtime.env.deployTarget === "github-pages",
      wantsHostedAdmin: runtime.mode === "hosted",
    }),
  };
}
