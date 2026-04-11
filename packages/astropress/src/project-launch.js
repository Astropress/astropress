import { createAstropressProjectRuntimePlan } from "./project-runtime.js";
import { recommendAstropressProvider } from "./provider-choice.js";

function resolveExistingPlatform(dataServices) {
  if (dataServices === "cloudflare" || dataServices === "supabase" || dataServices === "appwrite" || dataServices === "runway") {
    return dataServices;
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
    appHost: runtime.env.appHost,
    dataServices: runtime.env.dataServices,
    adminDbPath: runtime.env.adminDbPath,
    requiresLocalSeed: runtime.mode === "local",
    recommendation: recommendAstropressProvider({
      existingPlatform: resolveExistingPlatform(runtime.env.dataServices),
      wantsStaticMirror: runtime.env.appHost === "github-pages" || runtime.env.appHost === "gitlab-pages",
      wantsHostedAdmin: runtime.env.dataServices !== "none"
    })
  };
}
