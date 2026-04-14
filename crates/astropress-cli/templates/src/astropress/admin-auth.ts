import { createAstropressPasswordAuthModule } from "@astropress-diy/astropress/integration";

import { authenticatePersistedAdminUser } from "./runtime.ts";

export const hostRuntimeAdminAuth = createAstropressPasswordAuthModule(authenticatePersistedAdminUser);
