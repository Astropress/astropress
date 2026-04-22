function unavailable(): never {
	throw new Error(
		"The Node SQLite adapter is unavailable in the Cloudflare build. Use the Cloudflare/D1 adapter instead.",
	);
}

export function createAstropressSqliteAdapter() {
	unavailable();
}
