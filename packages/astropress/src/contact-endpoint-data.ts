// stryker-disable-file: data-only — contact endpoint field limits, rate-limit
// windows, and response header constants; no runtime logic.

export const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const JSON_HEADERS = { "Content-Type": "application/json" };

export const NAME_MAX_LENGTH = 200;
export const MESSAGE_MAX_LENGTH = 5000;

// Abuse limits mirror /ap/newsletter/subscribe (#136). Per-IP caps a single
// client; per-email stops a botnet from spoofing one address across IPs.
export const IP_RATE_LIMIT_MAX = 10;
export const IP_RATE_LIMIT_WINDOW_MS = 60_000;
export const EMAIL_RATE_LIMIT_MAX = 3;
export const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
