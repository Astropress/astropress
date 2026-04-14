import { createAstropressPasswordAuthModule } from "astropress/integration";

import { authenticatePersistedAdminUser } from "./runtime.ts";

export const hostRuntimeAdminAuth = createAstropressPasswordAuthModule(authenticatePersistedAdminUser);
