import { getCmsConfig } from "./config";

interface TranslationStatusRecord {
	route: string;
	locale: string;
	englishSourceUrl: string;
	translationState: string;
}

export interface AdminLocalePair {
	currentLocale: "en" | "es";
	englishRoute: string;
	localizedRoute?: string;
	translationState?: string;
}

function normalizeRoute(route: string) {
	if (!route) {
		return "/";
	}

	return route === "/" ? "/" : route.replace(/\/+$/, ""); // codeql[js/polynomial-redos] \/+ matches only '/' chars — linear, cannot backtrack past the end anchor
}

export function getAdminLocalePair(route: string): AdminLocalePair | null {
	const normalizedRoute = normalizeRoute(route);
	const entries = getCmsConfig().translationStatus as TranslationStatusRecord[];

	const localizedEntry = entries.find(
		(entry) => normalizeRoute(entry.route) === normalizedRoute,
	);
	if (localizedEntry) {
		return {
			currentLocale: "es",
			englishRoute: normalizeRoute(localizedEntry.englishSourceUrl),
			localizedRoute: normalizeRoute(localizedEntry.route),
			translationState: localizedEntry.translationState,
		};
	}

	const englishEntry = entries.find(
		(entry) => normalizeRoute(entry.englishSourceUrl) === normalizedRoute,
	);
	if (englishEntry) {
		return {
			currentLocale: "en",
			englishRoute: normalizeRoute(englishEntry.englishSourceUrl),
			localizedRoute: normalizeRoute(englishEntry.route),
			translationState: englishEntry.translationState,
		};
	}

	return null;
}
