import { serve } from "@hono/node-server";
import { createNexusApp } from "./app.js";
import { loadConfigFromFile } from "./registry.js";
import type { NexusConfig } from "./types.js";

const configPath = process.env.NEXUS_CONFIG ?? "nexus.config.json";
const authToken = process.env.NEXUS_AUTH_TOKEN;
const port = Number(process.env.PORT ?? 4330);

let config: NexusConfig;
try {
	config = loadConfigFromFile(configPath);
} catch (err) {
	console.error(`Failed to load nexus config from ${configPath}:`, err);
	process.exit(1);
}

const app = createNexusApp({ config, authToken });

serve({ fetch: app.fetch, port }, () => {
	console.log(`astropress-nexus listening on http://localhost:${port}`);
	console.log(`  ${config.sites.length} site(s) registered`);
});
