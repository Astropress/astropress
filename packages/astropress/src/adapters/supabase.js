import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressSupabaseAdapter(options = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "supabase"
  });
}

export function readAstropressSupabaseHostedConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Supabase hosted config requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return {
    url,
    anonKey,
    serviceRoleKey
  };
}

export function createAstropressSupabaseHostedAdapter(options = {}) {
  const config = options.config ?? readAstropressSupabaseHostedConfig(options.env);
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "supabase",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true
    },
    preview: options.preview ?? {
      async create() {
        return {
          url: `${config.url.replace(/\/$/, "")}/preview`
        };
      }
    }
  });
}
