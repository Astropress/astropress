/**
 * D1 sibling of `integrations.ts`. Mirrors the sqlite repository's
 * status + secret surface, but every method is async (D1's SDK
 * exposes only promise-returning calls) and `connect` is a single
 * `db.batch([...])` so the status row and the sealed-secret row land
 * atomically — important because the operator-visible "connected"
 * badge in the admin UI is keyed off the status row, and we never
 * want a window where it shows "connected" while the secret is still
 * missing (or, worse, vice-versa).
 *
 * Schema parity with the sqlite version is enforced by
 * `tooling/scripts/audit-integration-secrets-schema-parity.ts` — both
 * files share the same column names, kid values, and ON CONFLICT
 * shapes. A drift between the two raw SQL bodies fails CI.
 *
 * Why a separate file rather than parameterising the sqlite one:
 *   * the sqlite repo's sync surface (findStatus, listStatuses,
 *     updateStatus, disconnect, listPreviousKidContexts) is used
 *     transitively by code that is itself sync; making them async
 *     would force a Promise.all sweep through unrelated call sites.
 *     The D1 repo is async-only; the dispatch layer
 *     (`runtime-actions-integrations.ts`, the OAuth seal helper) is
 *     the place that bridges the two surfaces.
 *   * `db.batch()` is a D1-only primitive — there's no clean way to
 *     express it through the sqlite `prepare().run()` shape used by
 *     `node:sqlite` / `better-sqlite3`.
 */

import type { D1DatabaseLike } from "../d1-database";
import type {
	RootSecretCandidates,
	SealedSecret,
	SecretContext,
} from "../integration-secret-envelope";
import { openIntegrationSecret, sealIntegrationSecret } from "../integration-secret-envelope";
import type {
	ConnectIntegrationInput,
	IntegrationStatusRow,
	IntegrationStatusValue,
} from "./integrations";

// Shared SQL bodies — kept in sync with the sqlite file by the
// schema-parity audit. The exact whitespace + ON CONFLICT shape is
// what the audit checks, so do not "tidy" these without updating the
// parity audit's expectation in lockstep.
export const D1_SQL_FIND_STATUS = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error, is_active
    FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

export const D1_SQL_LIST_STATUSES = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error, is_active
    FROM connected_integrations
   ORDER BY domain, provider`;

export const D1_SQL_UPSERT_STATUS = `
  INSERT INTO connected_integrations (
    domain, provider, status, config_json, connected_at,
    last_check_at, last_error
  ) VALUES (?, ?, ?, ?, ?, NULL, NULL)
  ON CONFLICT(domain, provider) DO UPDATE SET
    status = excluded.status,
    config_json = excluded.config_json,
    connected_at = excluded.connected_at,
    last_check_at = NULL,
    last_error = NULL`;

export const D1_SQL_UPDATE_STATUS = `
  UPDATE connected_integrations
     SET status = ?, last_check_at = ?, last_error = ?
   WHERE domain = ? AND provider = ?`;

export const D1_SQL_DISCONNECT = `
  DELETE FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

// Active-provider selection (#127). Byte-identical with the sqlite sibling.
export const D1_SQL_CLEAR_ACTIVE_IN_DOMAIN = `
  UPDATE connected_integrations
     SET is_active = 0
   WHERE domain = ?`;

export const D1_SQL_MARK_ACTIVE = `
  UPDATE connected_integrations
     SET is_active = 1
   WHERE domain = ? AND provider = ? AND status = 'connected'`;

export const D1_SQL_COUNT_ACTIVE_IN_DOMAIN = `
  SELECT COUNT(*) AS n
    FROM connected_integrations
   WHERE domain = ? AND status = 'connected' AND is_active = 1`;

export const D1_SQL_FIND_SECRET = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE domain = ? AND provider = ?`;

export const D1_SQL_UPSERT_SECRET = `
  INSERT INTO integration_secrets (
    domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
    dek_wrap, data_iv, ciphertext, rotated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(domain, provider) DO UPDATE SET
    envelope_v = excluded.envelope_v,
    kid = excluded.kid,
    wrap_salt = excluded.wrap_salt,
    wrap_iv = excluded.wrap_iv,
    dek_wrap = excluded.dek_wrap,
    data_iv = excluded.data_iv,
    ciphertext = excluded.ciphertext,
    rotated_at = excluded.rotated_at`;

export const D1_SQL_RESEAL_GUARDED = `
  UPDATE integration_secrets
     SET envelope_v = ?, kid = ?, wrap_salt = ?, wrap_iv = ?,
         dek_wrap = ?, data_iv = ?, ciphertext = ?, rotated_at = ?
   WHERE domain = ? AND provider = ?
     AND ciphertext = ?
     AND kid = ?`;

export const D1_SQL_LIST_PREVIOUS_SECRETS = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE kid = 'previous'`;

interface RawStatusRow {
	readonly domain: string;
	readonly provider: string;
	readonly status: string;
	readonly config_json: string;
	readonly connected_at: string;
	readonly last_check_at: string | null;
	readonly last_error: string | null;
	readonly is_active: number;
}

interface RawSecretRow {
	readonly domain: string;
	readonly provider: string;
	readonly envelope_v: number;
	readonly kid: string;
	readonly wrap_salt: string;
	readonly wrap_iv: string;
	readonly dek_wrap: string;
	readonly data_iv: string;
	readonly ciphertext: string;
	readonly rotated_at: string;
}

function rowToStatus(row: RawStatusRow): IntegrationStatusRow {
	return {
		domain: row.domain,
		provider: row.provider,
		status: row.status as IntegrationStatusValue,
		configJson: row.config_json,
		connectedAt: row.connected_at,
		lastCheckAt: row.last_check_at,
		lastError: row.last_error,
		isActive: row.is_active === 1,
	};
}

function rowToSealed(row: RawSecretRow): SealedSecret {
	return {
		v: row.envelope_v as 1,
		kid: row.kid as "current" | "previous",
		wrap_salt: row.wrap_salt,
		wrap_iv: row.wrap_iv,
		dek_wrap: row.dek_wrap,
		data_iv: row.data_iv,
		ciphertext: row.ciphertext,
	};
}

export interface D1IntegrationsRepository {
	findStatus(domain: string, provider: string): Promise<IntegrationStatusRow | undefined>;
	listStatuses(): Promise<IntegrationStatusRow[]>;
	updateStatus(input: {
		domain: string;
		provider: string;
		status: IntegrationStatusValue;
		lastCheckAt: string;
		lastError?: string | null;
	}): Promise<boolean>;
	disconnect(domain: string, provider: string): Promise<boolean>;

	/** Makes `provider` the single active provider for `domain` (#127). */
	setActiveProvider(domain: string, provider: string): Promise<boolean>;

	connect<TFields extends Record<string, string> = Record<string, string>>(
		input: ConnectIntegrationInput<TFields>,
		rootSecret: string,
	): Promise<void>;

	findSecret<TFields extends Record<string, string> = Record<string, string>>(
		domain: string,
		provider: string,
		rootSecrets: RootSecretCandidates,
	): Promise<TFields | undefined>;

	listPreviousKidContexts(): Promise<SecretContext[]>;
}

export interface D1IntegrationsRepositoryOptions {
	getDb: () => D1DatabaseLike;
	/**
	 * Timestamp source for `findSecret`'s reseal-on-read UPDATE. Accepts
	 * either a literal ISO-8601 string (good enough for short-lived
	 * action handlers — connect/reverify/disconnect — that pass the
	 * caller's `now` directly) or a callable (used by long-lived hosts
	 * that mint a fresh timestamp per reseal). Other methods do not
	 * consult this field.
	 */
	now: string | (() => string);
}

export function createD1IntegrationsRepository(
	options: D1IntegrationsRepositoryOptions,
): D1IntegrationsRepository {
	const { getDb } = options;
	const now: () => string =
		typeof options.now === "function" ? options.now : () => options.now as string;

	async function findStatus(
		domain: string,
		provider: string,
	): Promise<IntegrationStatusRow | undefined> {
		const row = await getDb()
			.prepare(D1_SQL_FIND_STATUS)
			.bind(domain, provider)
			.first<RawStatusRow>();
		return row ? rowToStatus(row) : undefined;
	}

	async function listStatuses(): Promise<IntegrationStatusRow[]> {
		const result = await getDb().prepare(D1_SQL_LIST_STATUSES).all<RawStatusRow>();
		return result.results.map(rowToStatus);
	}

	async function updateStatus(input: {
		domain: string;
		provider: string;
		status: IntegrationStatusValue;
		lastCheckAt: string;
		lastError?: string | null;
	}): Promise<boolean> {
		const result = await getDb()
			.prepare(D1_SQL_UPDATE_STATUS)
			.bind(input.status, input.lastCheckAt, input.lastError ?? null, input.domain, input.provider)
			.run();
		// Stryker disable next-line all: defensive `?.` + `?? 0` cover a D1 SDK shape where `meta` is absent on a 0-row write; exercised by the "tolerates a D1 result without `meta`" test below but the equivalent-mutant pair survives stryker.
		return Number(result.meta?.changes ?? 0) > 0;
	}

	async function disconnect(domain: string, provider: string): Promise<boolean> {
		const result = await getDb().prepare(D1_SQL_DISCONNECT).bind(domain, provider).run();
		// Stryker disable next-line all: defensive `?.` + `?? 0` cover a D1 SDK shape where `meta` is absent on a 0-row write; exercised by the "tolerates a D1 result without `meta`" test below but the equivalent-mutant pair survives stryker.
		return Number(result.meta?.changes ?? 0) > 0;
	}

	async function setActiveProvider(domain: string, provider: string): Promise<boolean> {
		const db = getDb();
		await db.prepare(D1_SQL_CLEAR_ACTIVE_IN_DOMAIN).bind(domain).run();
		const result = await db.prepare(D1_SQL_MARK_ACTIVE).bind(domain, provider).run();
		// Stryker disable next-line all: defensive `?.` + `?? 0` mirror the disconnect/updateStatus guards for a D1 result without `meta`.
		return Number(result.meta?.changes ?? 0) > 0;
	}

	async function hasActiveProvider(domain: string): Promise<boolean> {
		const row = await getDb()
			.prepare(D1_SQL_COUNT_ACTIVE_IN_DOMAIN)
			.bind(domain)
			.first<{ n: number }>();
		return (row?.n ?? 0) > 0;
	}

	async function connect<TFields extends Record<string, string> = Record<string, string>>(
		input: ConnectIntegrationInput<TFields>,
		rootSecret: string,
	): Promise<void> {
		const sealed = await sealIntegrationSecret(
			input.secretFields,
			{ domain: input.domain, provider: input.provider },
			rootSecret,
		);
		const db = getDb();
		// Atomic batch — the operator never sees a half-applied
		// connect (status row written but secret missing, or vice
		// versa). D1 rolls back the entire batch on any failure.
		await db.batch([
			db
				.prepare(D1_SQL_UPSERT_STATUS)
				.bind(input.domain, input.provider, "connected", input.configJson, input.now),
			db
				.prepare(D1_SQL_UPSERT_SECRET)
				.bind(
					input.domain,
					input.provider,
					sealed.v,
					sealed.kid,
					sealed.wrap_salt,
					sealed.wrap_iv,
					sealed.dek_wrap,
					sealed.data_iv,
					sealed.ciphertext,
					input.now,
				),
		]);
		// First provider in a domain becomes active automatically; a later
		// connect never steals an existing active selection — switching is an
		// explicit admin action (#127). Runs after the atomic batch because the
		// is_active flag is not part of the connect's all-or-nothing invariant.
		if (!(await hasActiveProvider(input.domain))) {
			await db.prepare(D1_SQL_MARK_ACTIVE).bind(input.domain, input.provider).run();
		}
	}

	async function findSecret<TFields extends Record<string, string> = Record<string, string>>(
		domain: string,
		provider: string,
		rootSecrets: RootSecretCandidates,
	): Promise<TFields | undefined> {
		const row = await getDb()
			.prepare(D1_SQL_FIND_SECRET)
			.bind(domain, provider)
			.first<RawSecretRow>();
		if (!row) return undefined;
		const sealed = rowToSealed(row);
		const ctx: SecretContext = { domain, provider };
		const opened = await openIntegrationSecret<TFields>(sealed, ctx, rootSecrets);
		// Reseal-on-read: same predicate as the sqlite repo. The
		// guarded UPDATE matches on the *prior* ciphertext + kid, so
		// a concurrent reseal racing ahead silently loses with zero
		// rows affected — safe.
		if (opened.usedKid === "previous" && rootSecrets.previous) {
			const resealed = await sealIntegrationSecret(opened.fields, ctx, rootSecrets.current);
			await getDb()
				.prepare(D1_SQL_RESEAL_GUARDED)
				.bind(
					resealed.v,
					resealed.kid,
					resealed.wrap_salt,
					resealed.wrap_iv,
					resealed.dek_wrap,
					resealed.data_iv,
					resealed.ciphertext,
					now(),
					domain,
					provider,
					row.ciphertext,
					row.kid,
				)
				.run();
		}
		return opened.fields;
	}

	async function listPreviousKidContexts(): Promise<SecretContext[]> {
		const result = await getDb().prepare(D1_SQL_LIST_PREVIOUS_SECRETS).all<RawSecretRow>();
		return result.results.map((row) => ({
			domain: row.domain,
			provider: row.provider,
		}));
	}

	return {
		findStatus,
		listStatuses,
		updateStatus,
		disconnect,
		setActiveProvider,
		connect,
		findSecret,
		listPreviousKidContexts,
	};
}
