import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressTursoHostedConfig {
  databaseUrl: string;
  authToken: string;
  apiBaseUrl: string;
}

export type AstropressTursoAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

/**
 * Creates a Turso (LibSQL) adapter with database-only capabilities.
 *
 * Turso is a distributed SQLite-wire database — it does not provide object storage,
 * a hosted admin panel, or preview environments. Pair Turso with a server-side host
 * (Vercel, Netlify, Fly.io) for the app and a storage service for media uploads.
 */
export function createAstropressTursoAdapter(options: AstropressTursoAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "turso",
    defaultCapabilities: {
      hostedAdmin: false,
      previewEnvironments: false,
      serverRuntime: true,
      database: true,
      objectStorage: false,
      gitSync: false,
      ...options.defaultCapabilities,
    },
  });
}

export interface AstropressTursoHostedAdapterOptions extends AstropressTursoAdapterOptions {
  config?: AstropressTursoHostedConfig;
  env?: Record<string, string | undefined>;
}

export function readAstropressTursoHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressTursoHostedConfig {
  const databaseUrl = env.TURSO_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "Turso hosted config requires TURSO_DATABASE_URL (your Turso database URL).",
    );
  }

  if (!databaseUrl.startsWith("libsql://") && !databaseUrl.startsWith("https://")) {
    throw new Error(
      "Turso TURSO_DATABASE_URL must be a libsql:// or https:// connection string.",
    );
  }

  const authToken = env.TURSO_AUTH_TOKEN?.trim();

  if (!authToken) {
    throw new Error(
      "Turso hosted config requires TURSO_AUTH_TOKEN.",
    );
  }

  const dbName = databaseUrl.replace(/^libsql:\/\//, "").replace(/^https:\/\//, "").split(".")[0] ?? "";
  const apiBaseUrl = `https://app.turso.tech/databases/${dbName}`;

  return { databaseUrl, authToken, apiBaseUrl };
}

export function createAstropressTursoHostedAdapter(
  options: AstropressTursoHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressTursoHostedConfig(options.env);

  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "turso",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: false,
      previewEnvironments: false,
      serverRuntime: true,
      database: true,
      objectStorage: false,
      gitSync: false,
      hostPanel: options.defaultCapabilities?.hostPanel ?? {
        mode: "link",
        url: config.apiBaseUrl,
        label: "Turso Dashboard",
      },
    },
  });
}
