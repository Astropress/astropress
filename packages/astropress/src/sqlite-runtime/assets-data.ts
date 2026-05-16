// stryker-disable-file: data-only — module-level SQL statement constants that
// cache through the vitest worker pool (static mutants, empirically unkillable
// under the per-test runner). The behavioural callers in assets.ts execute
// every statement against a real SQLite database and are mutation-tested at
// ≥95%.

export const SQL_READ_RATE_LIMIT =
	"SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1";
export const SQL_RESET_RATE_LIMIT =
	"INSERT INTO rate_limits (key, count, window_start_ms, window_ms) VALUES (?, 1, ?, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start_ms = excluded.window_start_ms, window_ms = excluded.window_ms";
export const SQL_INC_RATE_LIMIT = "UPDATE rate_limits SET count = count + 1 WHERE key = ?";
export const SQL_UPDATE_MEDIA =
	"UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL";
export const SQL_INSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
export const SQL_GET_MEDIA_FOR_DELETE =
	"SELECT local_path FROM media_assets WHERE id = ? AND deleted_at IS NULL";
export const SQL_SOFT_DELETE_MEDIA =
	"UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?";
