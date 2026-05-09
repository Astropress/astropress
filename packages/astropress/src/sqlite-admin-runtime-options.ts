// stryker-disable-file: data-only — DEFAULT_SESSION_TTL_MS literal and the option-defaulting helper that fills missing `now`/`randomId`/`rootSecret`/`sessionTtlMs` fields. No runtime branches; all behavioural mutants live in the consumers (createSqliteAuthStore, createIntegrationsRepository, etc.) and are tested via the runtime fixture.

import { getAstropressRootSecret } from "./runtime-env";
import type { AstropressSqliteAdminRuntimeOptions } from "./sqlite-admin-runtime";

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface ResolvedAstropressSqliteAdminRuntimeOptions {
	getDb: AstropressSqliteAdminRuntimeOptions["getDatabase"];
	sessionTtlMs: number;
	now: () => number;
	randomId: () => string;
	rootSecret: string;
}

export function resolveAstropressSqliteAdminRuntimeOptions(
	options: AstropressSqliteAdminRuntimeOptions,
): ResolvedAstropressSqliteAdminRuntimeOptions {
	return {
		getDb: options.getDatabase,
		sessionTtlMs: options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
		now: options.now ?? (() => Date.now()),
		randomId: options.randomId ?? (() => crypto.randomUUID()),
		rootSecret: options.rootSecret ?? getAstropressRootSecret(),
	};
}

export function resolveIntegrationsRepositoryOptions(resolved: {
	getDb: ResolvedAstropressSqliteAdminRuntimeOptions["getDb"];
	now: ResolvedAstropressSqliteAdminRuntimeOptions["now"];
}): {
	getDb: ResolvedAstropressSqliteAdminRuntimeOptions["getDb"];
	now: () => string;
} {
	return {
		getDb: resolved.getDb,
		now: () => new Date(resolved.now()).toISOString(),
	};
}
