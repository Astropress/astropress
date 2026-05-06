// stryker-disable-file: data-only — cloudflare adapter constants.
// CLOUDFLARE_SESSION_TTL_MS is the canonical session-expiry budget;
// mutating its arithmetic factors only changes a number that callers
// compare against `Date.now() - lastActiveAt`. Behavioural coverage of
// the expiry boundary lives in the consumer (getLiveCloudflareSessionRow).
// The default-secret literal must match exactly between the env-default
// and the production-runtime check that triggers the throw — splitting
// it here keeps both call sites referring to the same constant.

export const CLOUDFLARE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const CLOUDFLARE_SESSION_LOGGER_CONTEXT = "Cloudflare";

export const CLOUDFLARE_DEFAULT_SESSION_SECRET = "cloudflare-adapter-session-secret";
