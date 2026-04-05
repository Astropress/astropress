import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressSupabaseAdapter(options = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "supabase"
  });
}
