import { createAstropressCmsRegistryModule } from "astropress/integration";

import { sqliteCmsRegistryModule } from "./runtime.ts";

export const hostRuntimeCmsRegistry = createAstropressCmsRegistryModule(sqliteCmsRegistryModule);
