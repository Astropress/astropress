// stryker-disable-file: data-only — capability flag table + soft-delete SQL strings for the Cloudflare adapter; data, not behaviour.

export const CF_CAPS = {
	name: "cloudflare" as const,
	staticPublishing: true,
	hostedAdmin: true,
	previewEnvironments: true,
	serverRuntime: true,
	database: true,
	objectStorage: true,
	gitSync: true,
};
export const SQL_CF_SOFT_DELETE_REDIRECT =
	"UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL";
export const SQL_CF_SOFT_DELETE_MEDIA =
	"UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?";
