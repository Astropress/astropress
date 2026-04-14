import { createAstropressCmsRegistryModule } from "@astropress-diy/astropress/integration";

import { sqliteCmsRegistryModule } from "./runtime.ts";

export const hostRuntimeCmsRegistry = createAstropressCmsRegistryModule(sqliteCmsRegistryModule);
