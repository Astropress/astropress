import { normalizeRedirectTarget, normalizeSlug } from "./persistence-commons";

export {
	parseIdList,
	serializeIdList,
} from "./persistence-commons";

/** Generic path normalization — ensures a leading slash, trims whitespace. */
export function normalizePath(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const normalizeRedirectPath = normalizeRedirectTarget;

export function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

export const slugify = normalizeSlug;

/** Alias for slugify — used for content post slugs. */
export const slugifyContent = normalizeSlug;
