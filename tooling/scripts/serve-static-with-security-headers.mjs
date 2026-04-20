#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const rootDir = resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3] ?? "4173");

const contentTypes = new Map([
	[".css", "text/css; charset=utf-8"],
	[".html", "text/html; charset=utf-8"],
	[".ico", "image/x-icon"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".js", "text/javascript; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".png", "image/png"],
	[".svg", "image/svg+xml"],
	[".txt", "text/plain; charset=utf-8"],
	[".webp", "image/webp"],
	[".woff", "font/woff"],
	[".woff2", "font/woff2"],
	[".xml", "application/xml; charset=utf-8"],
]);

function applySecurityHeaders(response) {
	response.setHeader(
		"Content-Security-Policy",
		"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
	);
	response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
	response.setHeader(
		"Permissions-Policy",
		"accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
	);
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", "DENY");
	response.removeHeader("Server");
}

function resolveRequestPath(urlPath) {
	const pathname = decodeURIComponent((urlPath ?? "/").split("?")[0]);
	const relativePath =
		pathname === "/"
			? "index.html"
			: pathname.endsWith("/")
				? join(pathname, "index.html")
				: pathname.slice(1);
	const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
	return join(rootDir, safePath);
}

const server = createServer(async (request, response) => {
	try {
		const candidate = resolveRequestPath(request.url);
		const filePath = candidate.startsWith(rootDir)
			? candidate
			: join(rootDir, "index.html");
		const body = await readFile(filePath);
		applySecurityHeaders(response);
		response.statusCode = 200;
		response.setHeader(
			"Content-Type",
			contentTypes.get(extname(filePath)) ?? "application/octet-stream",
		);
		response.end(body);
	} catch {
		applySecurityHeaders(response);
		response.statusCode = 404;
		response.setHeader("Content-Type", "text/plain; charset=utf-8");
		response.end("Not found");
	}
});

server.listen(port, "127.0.0.1", () => {
	console.log(`Serving ${rootDir} on http://127.0.0.1:${port}`);
});
