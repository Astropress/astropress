/**
 * /ap-api/v1/og-image/[slug].png
 *
 * Auto-generates a social sharing image (OG image) for any content record.
 * Returns an SVG image with the content title and site name on a gradient background.
 *
 * Query params:
 *   ?title=My Post Title     — the text to display (required)
 *   ?site=My Site Name       — site name displayed below the title (optional)
 *   ?bg=1e3a5f              — hex background color without # (default: 1e3a5f)
 *   ?fg=ffffff              — hex text color without # (default: ffffff)
 */

export const prerender = false;

function escapeXml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Wrap a long title string onto at most 2 lines at word boundaries. */
function wrapTitle(title, maxLen = 28) {
	if (title.length <= maxLen) return [title, ""];
	const words = title.split(" ");
	let line1 = "";
	let line2 = "";
	let switchedToLine2 = false;
	for (const word of words) {
		if (!switchedToLine2 && `${line1} ${word}`.trim().length <= maxLen) {
			line1 = `${line1} ${word}`.trim();
		} else {
			switchedToLine2 = true;
			line2 = `${line2} ${word}`.trim();
		}
	}
	if (line2.length > maxLen + 4) {
		line2 = `${line2.slice(0, maxLen + 1)}…`;
	}
	return [line1, line2];
}

export const GET = ({ request }) => {
	const url = new URL(request.url);
	const title = url.searchParams.get("title") ?? "Untitled";
	const site = url.searchParams.get("site") ?? "";
	const bg = url.searchParams.get("bg") ?? "1e3a5f";
	const fg = url.searchParams.get("fg") ?? "ffffff";

	const safeTitle = escapeXml(title);
	const safeSite = escapeXml(site);
	const safeBg = /^[0-9a-fA-F]{3,6}$/.test(bg) ? bg : "1e3a5f";
	const safeFg = /^[0-9a-fA-F]{3,6}$/.test(fg) ? fg : "ffffff";

	const [line1, line2] = wrapTitle(title);
	const safeLine1 = escapeXml(line1);
	const safeLine2 = escapeXml(line2);

	const titleY = line2 ? 180 : 210;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#${safeBg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#${safeBg}cc;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="80" y="80" width="8" height="470" fill="#${safeFg}" opacity="0.4" rx="4" />
  <text
    x="140" y="${titleY}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="72"
    font-weight="700"
    fill="#${safeFg}"
    letter-spacing="-1"
  >${safeLine1}</text>
  ${
		line2
			? `<text
    x="140" y="${titleY + 90}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="72"
    font-weight="700"
    fill="#${safeFg}"
    letter-spacing="-1"
  >${safeLine2}</text>`
			: ""
	}
  ${
		safeSite
			? `<text
    x="140" y="540"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="36"
    fill="#${safeFg}"
    opacity="0.7"
  >${safeSite}</text>`
			: ""
	}
</svg>`;

	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=86400, immutable",
		},
	});
};
