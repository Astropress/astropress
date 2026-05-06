// stryker-disable-file: data-only — pure interface declarations mirroring D1 SDK shape.
// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK row-shape default
export interface D1Result<T = Record<string, unknown>> {
	success: boolean;
	// audit-boundary: opaque-passthrough -- D1 driver returns arbitrary metadata fields
	meta?: Record<string, unknown>;
	results: T[];
}

export interface D1PreparedStatement {
	// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK bind-arg shape
	bind(...values: unknown[]): D1PreparedStatement;
	// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK row-shape default
	first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
	// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK row-shape default
	all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
	// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK row-shape default
	run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1DatabaseLike {
	prepare(query: string): D1PreparedStatement;
	/**
	 * Execute multiple prepared statements atomically as a single batch.
	 * All statements either succeed together or all are rolled back.
	 * Use this for multi-step writes that require atomicity on Cloudflare D1.
	 *
	 * @example
	 * ```ts
	 * await db.batch([
	 *   db.prepare("DELETE FROM content_locks WHERE expires_at <= ?").bind(now),
	 *   db.prepare("INSERT INTO content_locks (slug, ...) VALUES (?, ...)").bind(slug, ...),
	 * ]);
	 * ```
	 */
	// audit-boundary: opaque-passthrough -- mirrors Cloudflare D1 SDK row-shape default
	batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
