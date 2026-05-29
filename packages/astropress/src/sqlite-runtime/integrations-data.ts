// stryker-disable-file: data-only — SQL query strings for the connected-integrations
// + integration-secrets stores. Mutation of these literals is verified by the
// repository integration tests against the live SQLite schema, not by the unit
// mutation gate (the gate's per-test coverage attribution + worker recycling
// cannot kill them); they are data, not branching behaviour.

export const SQL_FIND_STATUS = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error, is_active
    FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

export const SQL_LIST_STATUSES = `
  SELECT domain, provider, status, config_json, connected_at,
         last_check_at, last_error, is_active
    FROM connected_integrations
   ORDER BY domain, provider`;

export const SQL_UPSERT_STATUS = `
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

export const SQL_UPDATE_STATUS = `
  UPDATE connected_integrations
     SET status = ?, last_check_at = ?, last_error = ?
   WHERE domain = ? AND provider = ?`;

export const SQL_DISCONNECT = `
  DELETE FROM connected_integrations
   WHERE domain = ? AND provider = ?`;

// Active-provider selection (#127). Not part of the schema-parity statement
// set, but kept byte-identical with the D1 sibling for consistency.
export const SQL_CLEAR_ACTIVE_IN_DOMAIN = `
  UPDATE connected_integrations
     SET is_active = 0
   WHERE domain = ?`;

export const SQL_MARK_ACTIVE = `
  UPDATE connected_integrations
     SET is_active = 1
   WHERE domain = ? AND provider = ? AND status = 'connected'`;

export const SQL_COUNT_ACTIVE_IN_DOMAIN = `
  SELECT COUNT(*) AS n
    FROM connected_integrations
   WHERE domain = ? AND status = 'connected' AND is_active = 1`;

export const SQL_FIND_SECRET = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE domain = ? AND provider = ?`;

export const SQL_UPSERT_SECRET = `
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
export const SQL_RESEAL_GUARDED = `
  UPDATE integration_secrets
     SET envelope_v = ?, kid = ?, wrap_salt = ?, wrap_iv = ?,
         dek_wrap = ?, data_iv = ?, ciphertext = ?, rotated_at = ?
   WHERE domain = ? AND provider = ?
     AND ciphertext = ?
     AND kid = ?`;

export const SQL_LIST_PREVIOUS_SECRETS = `
  SELECT domain, provider, envelope_v, kid, wrap_salt, wrap_iv,
         dek_wrap, data_iv, ciphertext, rotated_at
    FROM integration_secrets
   WHERE kid = 'previous'`;
