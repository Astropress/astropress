import { createAstropressAdminStoreModule } from "astropress/integration";

import { sqliteAdminStore } from "./runtime.ts";

export const hostRuntimeAdminStore = createAstropressAdminStoreModule(() => sqliteAdminStore);
