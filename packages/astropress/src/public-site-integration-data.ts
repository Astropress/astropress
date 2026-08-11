// stryker-disable-file: data-only — module-load path resolution for the public
// integration. `packageRoot`/`packageResource` are top-level (static) values
// that report as Survived under Stryker's runner despite `ignoreStatic` (see
// CLAUDE.md "module-level constants belong in *-data.ts siblings"). The runtime
// hooks that consume them are mutation-tested in public-site-integration.ts.
import { join } from "node:path";
import { resolvePackageRoot } from "./integration-host-config";

export const packageRoot = resolvePackageRoot(import.meta.url);

export const packageResource = (relativePath: string) => join(packageRoot, relativePath);
