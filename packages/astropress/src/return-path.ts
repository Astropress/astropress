export function resolveSafeReturnPath(
	referer: string | null | undefined,
	fallbackPath: string,
) {
	if (!referer) {
		return fallbackPath;
	}

	if (referer.startsWith("/")) {
		return referer;
	}

	try {
		const url = new URL(referer);
		return `${url.pathname || "/"}${url.search}${url.hash}`;
	} catch {
		return fallbackPath;
	}
}

export function appendQueryParam(path: string, key: string, value: string) {
	const separator = path.includes("?") ? "&" : "?";
	return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}
