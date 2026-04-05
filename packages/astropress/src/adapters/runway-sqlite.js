import { createAstropressSqliteAdapter } from "./sqlite.js";
import { createAstropressRunwayAdapter } from "./runway.js";

export function createAstropressRunwaySqliteAdapter(options = {}) {
  return createAstropressRunwayAdapter({
    backingAdapter: createAstropressSqliteAdapter(options)
  });
}
