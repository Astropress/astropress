/**
 * Add loading="lazy" to img tags that don't already have a loading attribute.
 * This optimizes performance by deferring off-viewport image loads.
 */
export function optimizeImageLoading(html: string): string {
	let firstImage = true;

	return html.replace(/<img([^>]*?)>/g, (match, attrs) => {
		// Skip if already has a loading attribute (lazy, eager, etc.)
		if (/\bloading\s*=\s*["'][^"']*["']/i.test(attrs)) {
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
