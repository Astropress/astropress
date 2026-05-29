// stryker-disable-file: data-only — SQL-string constants for the sqlite author store; mutants unobservable under mock-driver unit tests, unkillable as static-true.

export const SQL_INSERT_AUTHOR = "INSERT INTO authors (slug, name, bio) VALUES (?, ?, ?)";
export const SQL_UPDATE_AUTHOR =
	"UPDATE authors SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";
export const SQL_DELETE_AUTHOR =
	"UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";
