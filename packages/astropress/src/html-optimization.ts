/**
 * Add loading="lazy" to img tags that don't already have a loading attribute.
 * This optimizes performance by deferring off-viewport image loads.
 */
export function optimizeImageLoading(html: string): string {
	let firstImage = true;

	const IMG_TAG_RE = /<img([^>]*)>/g;
	return html.replace(IMG_TAG_RE, (match, attrs) => {
		// Skip if already has a loading attribute (lazy, eager, etc.)
		// Use a simple string check to avoid nested-quantifier ReDoS warnings
		if (/\bloading=/i.test(attrs)) {
			firstImage = false;
			return match;
		}

		// Don't lazy load images marked as high-priority (fetchpriority attribute)
		if (attrs.includes("fetchpriority")) {
			firstImage = false;
			return match;
		}

		// Don't lazy load the first image in the body (likely hero/LCP)
		if (firstImage) {
			firstImage = false;
			return match;
		}

		firstImage = false;
		// Add loading="lazy" to optimize off-viewport images
		return `<img${attrs} loading="lazy">`;
	});
}
