import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import {
	createAstropressViteIntegration,
	createAstropressAdminAppIntegration,
	createAstropressPublicSiteIntegration,
} from "@astropress-diy/astropress/integration";

// Local authoring runs the admin in server mode (`astro dev`); the production
// build is fully static (`astro build`) with zero admin surface — deploy that.
const isDev = process.argv.includes("dev");

const viteIntegration = createAstropressViteIntegration({
	localRuntimeModulesPath: fileURLToPath(
		new URL("./src/astropress/local-runtime-modules.ts", import.meta.url),
	),
});

export default defineConfig({
	output: isDev ? "server" : "static",
	integrations: isDev
		? [
				createAstropressAdminAppIntegration(),
				// Admin already injects sitemap/robots/llms in dev; skip the duplicates.
				createAstropressPublicSiteIntegration({ includeSupportRoutes: false }),
			]
		: [createAstropressPublicSiteIntegration()],
	vite: {
		plugins: viteIntegration.plugins,
		resolve: { alias: viteIntegration.aliases },
		build: { rollupOptions: { external: ["sharp"] } },
	},
});
