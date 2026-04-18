/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Adapters must not depend on runtime layer — enforces dependency direction.
    // The adapter layer (d1-*, sqlite-*, adapters/) provides storage implementations
    // that the runtime layer consumes, not the other way around.
    {
      name: "adapter-no-runtime-import",
      severity: "error",
      comment: "Adapter files must not import from runtime-* files (adapter layer cannot depend on runtime layer)",
      from: { path: "^packages/astropress/src/(d1-|adapters/)" },
      to: {
        path: "^packages/astropress/src/runtime-",
        pathNot: "^packages/astropress/src/runtime-(env|logger|health)\\.ts$",
      },
    },
    // Pages must not import directly from sqlite-runtime — they go through the
    // admin-store-dispatch seam.
    {
      name: "pages-no-direct-sqlite",
      severity: "error",
      comment: "Admin pages must use the store dispatch seam, not import sqlite-runtime directly",
      from: { path: "^packages/astropress/pages/" },
      to: { path: "^packages/astropress/src/sqlite-runtime/" },
    },
    // Test files must not be imported by source files.
    {
      name: "no-test-in-source",
      severity: "error",
      comment: "Source files must not import from test files",
      from: { path: "^packages/astropress/src/" },
      to: { path: "^packages/astropress/tests/" },
    },
    // Tooling scripts must not import from package source (they should use the
    // public API or file-system analysis).
    {
      name: "tooling-no-source-import",
      severity: "error",
      comment: "Tooling scripts must not import from package source — use file-system analysis or the public API",
      from: { path: "^tooling/scripts/" },
      to: { path: "^packages/astropress/src/" },
    },
    // No circular dependencies in source.
    {
      name: "no-circular",
      severity: "warn",
      comment: "Circular dependencies make the codebase harder to reason about",
      from: { path: "^packages/astropress/src/" },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
