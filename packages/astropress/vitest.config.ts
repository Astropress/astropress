import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "astropress", replacement: fileURLToPath(new URL("./index.ts", import.meta.url)) },
      { find: "cloudflare:workers", replacement: fileURLToPath(new URL("./src/cloudflare-workers-stub.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
