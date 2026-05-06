/**
 * Repository over the connected_integrations + integration_secrets
 * tables. Two halves with deliberately separated surfaces:
 *
 *   - Status surface (findStatus, listStatuses, updateStatus,
 *     disconnect): never reads from `integration_secrets`. Sidebar
 *     status badges and dashboards must call only these methods, so
 *     ciphertext stays off the read path.
 *
 *   - Secret surface (findSecret, upsertSecret): explicit
 *     `rootSecrets` argument gates every plaintext access. After a
 *     successful previous-key decrypt, opportunistically reseals
 *     under current with a guarded UPDATE so a concurrent admin
 *     write isn't clobbered.
 *
 * Design doc: tooling/docs/phase-2-secret-store-design.md
 */

import type {
	RootSecretCandidates,
	SealedSecret,
	SecretContext,
} from "../integration-secret-envelope";
import { openIntegrationSecret, sealIntegrationSecret } from "../integration-secret-envelope";
import type { AstropressSqliteDatabaseLike } from "./utils";

export type IntegrationStatusValue = "connected" | "error" | "paused";

export interface IntegrationStatusRow {
	domain: string;
	provider: string;
	status: IntegrationStatusValue;
	configJson: string;
	connectedAt: string;
	lastCheckAt: string | null;
	lastError: string | null;
}

export interface ConnectIntegrationInput<
	TFields extends Record<string, string> = Record<string, string>,
> {
	domain: string;
	provider: string;
	configJson: string;
	secretFields: TFields;
	now: string; // ISO 8601
}

export interface IntegrationsRepositoryOptions {
	getDb: () => AstropressSqliteDatabaseLike;
	now: () => string;
}

interface RawStatusRow {
	domain: string;
	provider: string;
	status: string;
	config_json: string;
	connected_at: string;
	last_check_at: string | null;
	last_error: string | null;
}

interface RawSecretRow {
	domain: string;
	provider: string;
	envelope_v: number;
	kid: string;
	wrap_salt: string;
	wrap_iv: string;
	dek_wrap: string;
	data_iv: string;
	ciphertext: string;
	rotated_at: string;
}

const SQL_FIND_STATUS = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error
    FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

const SQL_LIST_STATUSES = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error
    FROM connected_integrations
   ORDER BY domain, provider`;

const SQL_UPSERT_STATUS = `
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

const SQL_UPDATE_STATUS = `
  UPDATE connected_integrations
     SET status = ?, last_check_at = ?, last_error = ?
   WHERE domain = ? AND provider = ?`;

const SQL_DISCONNECT = `
  DELETE FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

const SQL_FIND_SECRET = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE domain = ? AND provider = ?`;

const SQL_UPSERT_SECRET = `
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

/**
 * Update only when the row still matches the ciphertext we just
 * decrypted. If a concurrent reseal raced ahead, our update is a
 * no-op and the running record stays consistent.
 */
const SQL_RESEAL_GUARDED = `
  UPDATE integration_secrets
     SET envelope_v = ?, kid = ?, wrap_salt = ?, wrap_iv = ?,
         dek_wrap = ?, data_iv = ?, ciphertext = ?, rotated_at = ?
   WHERE domain = ? AND provider = ?
     AND ciphertext = ?
     AND kid = ?`;

const SQL_LIST_PREVIOUS_SECRETS = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE kid = 'previous'`;

function rowToStatus(row: RawStatusRow): IntegrationStatusRow {
	return {
		domain: row.domain,
		provider: row.provider,
		status: row.status as IntegrationStatusValue,
		configJson: row.config_json,
		connectedAt: row.connected_at,
		lastCheckAt: row.last_check_at,
		lastError: row.last_error,
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

export interface IntegrationsRepository {
	findStatus(domain: string, provider: string): IntegrationStatusRow | undefined;
	listStatuses(): IntegrationStatusRow[];
	updateStatus(input: {
		domain: string;
		provider: string;
		status: IntegrationStatusValue;
		lastCheckAt: string;
		lastError?: string | null;
	}): boolean;
	disconnect(domain: string, provider: string): boolean;

	connect<TFields extends Record<string, string> = Record<string, string>>(
		input: ConnectIntegrationInput<TFields>,
		rootSecret: string,
	): Promise<void>;

	findSecret<TFields extends Record<string, string> = Record<string, string>>(
		domain: string,
		provider: string,
		rootSecrets: RootSecretCandidates,
	): Promise<TFields | undefined>;

	listPreviousKidContexts(): SecretContext[];
}

export function createIntegrationsRepository(
	options: IntegrationsRepositoryOptions,
): IntegrationsRepository {
	const { getDb, now } = options;

	function findStatus(domain: string, provider: string): IntegrationStatusRow | undefined {
		const row = getDb().prepare(SQL_FIND_STATUS).get(domain, provider) as RawStatusRow | undefined;
		return row ? rowToStatus(row) : undefined;
	}

	function listStatuses(): IntegrationStatusRow[] {
		const rows = getDb().prepare(SQL_LIST_STATUSES).all() as RawStatusRow[];
		return rows.map(rowToStatus);
	}

	function updateStatus(input: {
		domain: string;
		provider: string;
		status: IntegrationStatusValue;
		lastCheckAt: string;
		lastError?: string | null;
	}): boolean {
		const result = getDb()
			.prepare(SQL_UPDATE_STATUS)
			.run(input.status, input.lastCheckAt, input.lastError ?? null, input.domain, input.provider);
		return Number(result.changes ?? 0) > 0;
	}

	function disconnect(domain: string, provider: string): boolean {
		const result = getDb().prepare(SQL_DISCONNECT).run(domain, provider);
		return Number(result.changes ?? 0) > 0;
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
		db.prepare(SQL_UPSERT_STATUS).run(
			input.domain,
			input.provider,
			"connected",
			input.configJson,
			input.now,
		);
		db.prepare(SQL_UPSERT_SECRET).run(
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
		);
	}

	async function findSecret<TFields extends Record<string, string> = Record<string, string>>(
		domain: string,
		provider: string,
		rootSecrets: RootSecretCandidates,
	): Promise<TFields | undefined> {
		const row = getDb().prepare(SQL_FIND_SECRET).get(domain, provider) as RawSecretRow | undefined;
		if (!row) return undefined;
		const sealed = rowToSealed(row);
		const ctx: SecretContext = { domain, provider };
		const opened = await openIntegrationSecret<TFields>(sealed, ctx, rootSecrets);
		// Reseal-on-read: when we just decrypted with the previous key, push
		// the record forward under current in a guarded UPDATE.
		if (opened.usedKid === "previous" && rootSecrets.previous) {
			const resealed = await sealIntegrationSecret(opened.fields, ctx, rootSecrets.current);
			getDb()
				.prepare(SQL_RESEAL_GUARDED)
				.run(
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
				);
		}
		return opened.fields;
	}

	function listPreviousKidContexts(): SecretContext[] {
		const rows = getDb().prepare(SQL_LIST_PREVIOUS_SECRETS).all() as RawSecretRow[];
		return rows.map((row) => ({
			domain: row.domain,
			provider: row.provider,
		}));
	}

	return {
		findStatus,
		listStatuses,
		updateStatus,
		disconnect,
		connect,
		findSecret,
		listPreviousKidContexts,
	};
}
