import { readFileSync } from "node:fs";
import type { NexusConfig, SiteEntry } from "./types.js";

export class SiteRegistry {
	private readonly sites: Map<string, SiteEntry>;

	constructor(config: NexusConfig) {
		this.sites = new Map(config.sites.map((site) => [site.id, site]));
	}

	getAll(): SiteEntry[] {
		return [...this.sites.values()];
	}

	get(id: string): SiteEntry | undefined {
		return this.sites.get(id);
	}

	has(id: string): boolean {
		return this.sites.has(id);
	}

	size(): number {
		return this.sites.size;
	}
}

export function loadConfigFromFile(filePath: string): NexusConfig {
	return JSON.parse(readFileSync(filePath, "utf8")) as NexusConfig;
}
