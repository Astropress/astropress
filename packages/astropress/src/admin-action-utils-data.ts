// stryker-disable-file: data-only — admin action wiring constants.
// Cookie names and default user-facing messages used by the form-action
// guard. The cookie names are matched against incoming Astro cookie reads
// (string identity); the messages are returned to the browser when the
// guard short-circuits. Mutating either changes the wire shape only —
// behavioural coverage of the auth/csrf/origin paths lives in the consumer
// (admin-action-utils.ts) and the e2e harness.

export const LEGACY_SESSION_COOKIE = "ff_admin_session";
export const LOCAL_SESSION_COOKIE = "astropress_admin_session";
export const SECURE_SESSION_COOKIE = "__Host-astropress_admin_session";

export const ADMIN_ACTION_LOGGER_CONTEXT = "admin-action";

export const DEFAULT_ADMIN_REQUIRED_MESSAGE = "This action requires an admin account.";
export const DEFAULT_ACTION_DENIED_MESSAGE = "You do not have permission to perform this action.";
export const DEFAULT_INVALID_CSRF_MESSAGE = "Invalid security token";
export const DEFAULT_INVALID_ORIGIN_MESSAGE = "Invalid request origin";
export const DEFAULT_LOGIN_PATH = "/ap-admin/login";
export const DEFAULT_UNEXPECTED_MESSAGE =
	"The requested change could not be completed. Reload the page and retry the action.";
