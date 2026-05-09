import { createAstropressAdminStoreModule } from "@astropress-diy/astropress/integration";

import { sqliteAdminStore } from "./runtime.ts";

export const hostRuntimeAdminStore = createAstropressAdminStoreModule(() => sqliteAdminStore);
