import { createAstropressProjectRuntimePlan } from "./project-runtime.js";
import { recommendAstropressProvider } from "./provider-choice.js";

function resolveExistingPlatform(provider, mode) {
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

export function createAstropressProjectLaunchPlan(options = {}) {
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
