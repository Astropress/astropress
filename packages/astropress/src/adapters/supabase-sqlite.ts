import type { AstropressSqliteAdapterOptions } from "./sqlite";
import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressSupabaseAdapter } from "./supabase";

export type AstropressSupabaseSqliteAdapterOptions =
	AstropressSqliteAdapterOptions;

export function createAstropressSupabaseSqliteAdapter(
	options: AstropressSupabaseSqliteAdapterOptions = {},
) {
	return createAstropressSupabaseAdapter({
		backingAdapter: createAstropressSqliteAdapter(options),
	});
}
