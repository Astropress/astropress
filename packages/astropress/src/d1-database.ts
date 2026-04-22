export interface D1Result<T = Record<string, unknown>> {
	success: boolean;
	results: T[];
	meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
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
	batch<T = Record<string, unknown>>(
		statements: D1PreparedStatement[],
	): Promise<D1Result<T>[]>;
}
