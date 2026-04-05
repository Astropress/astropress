import type { AstropressSqliteAdapterOptions } from "./sqlite";
import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressRunwayAdapter } from "./runway";

export type AstropressRunwaySqliteAdapterOptions = AstropressSqliteAdapterOptions;

export function createAstropressRunwaySqliteAdapter(options: AstropressRunwaySqliteAdapterOptions = {}) {
  return createAstropressRunwayAdapter({
    backingAdapter: createAstropressSqliteAdapter(options),
  });
}
