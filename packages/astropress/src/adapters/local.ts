import type { AstropressPlatformAdapter } from "../platform-contracts";
import {
  createAstropressRunwaySqliteAdapter,
  type AstropressRunwaySqliteAdapterOptions,
} from "./runway-sqlite";
import {
  createAstropressSqliteAdapter,
  type AstropressSqliteAdapterOptions,
} from "./sqlite";
import {
  createAstropressSupabaseSqliteAdapter,
  type AstropressSupabaseSqliteAdapterOptions,
} from "./supabase-sqlite";

export type AstropressLocalProviderKind = "sqlite" | "supabase" | "runway";

export type AstropressLocalAdapterOptions = AstropressSqliteAdapterOptions & {
  provider?: AstropressLocalProviderKind;
};

function normalizeLocalProvider(provider?: string | null): AstropressLocalProviderKind {
  if (provider === "supabase" || provider === "runway") {
    return provider;
  }
  return "sqlite";
}

export function createAstropressLocalAdapter(
  options: AstropressLocalAdapterOptions = {},
): AstropressPlatformAdapter {
  const provider = normalizeLocalProvider(options.provider ?? process.env.ASTROPRESS_LOCAL_PROVIDER ?? null);

  if (provider === "supabase") {
    return createAstropressSupabaseSqliteAdapter(options satisfies AstropressSupabaseSqliteAdapterOptions);
  }

  if (provider === "runway") {
    return createAstropressRunwaySqliteAdapter(options satisfies AstropressRunwaySqliteAdapterOptions);
  }

  return createAstropressSqliteAdapter(options);
}
