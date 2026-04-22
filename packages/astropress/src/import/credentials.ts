import { readFile, writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WordPressCredentials = {
	url: string;
	username: string;
	password: string;
};

export type WixCredentials = {
	email: string;
	password: string;
};

export type CredentialsFile = {
	wordpress?: WordPressCredentials;
	wix?: WixCredentials;
};

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

export function validateUrl(url: string): void {
	if (!url || url.trim() === "") {
		throw new Error("URL is required");
	}
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("URL must include a protocol (https:// or http://)");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new Error("URL must use http or https");
	}
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

export async function loadCredentialsFile(
	filePath: string,
): Promise<CredentialsFile> {
	let text: string;
	try {
		text = await readFile(filePath, "utf8");
	} catch (err) {
		if (err instanceof Error && "code" in err && err.code === "ENOENT") {
			throw new Error(`Credentials file not found: ${filePath}`);
		}
		throw err;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error(`Credentials file is not valid JSON: ${filePath}`);
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("Credentials file must be a JSON object");
	}

	return parsed as CredentialsFile;
}

export async function saveCredentialsFile(
	filePath: string,
	config: CredentialsFile,
): Promise<void> {
	try {
		await writeFile(filePath, JSON.stringify(config, null, 2));
	} catch (err) {
		if (err instanceof Error && "code" in err && err.code === "EACCES") {
			throw new Error("Cannot write credentials file: permission denied");
		}
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

function requireField(
	obj: Record<string, unknown>,
	field: string,
	context: string,
): string {
	const value = obj[field];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${context} credentials are missing '${field}'`);
	}
	return value;
}

export async function resolveWordPressCredentials(opts: {
	url: string;
	credentialsFile?: string;
	username?: string;
	password?: string;
}): Promise<WordPressCredentials> {
	if (opts.credentialsFile) {
		const config = await loadCredentialsFile(opts.credentialsFile);
		if (!config.wordpress) {
			throw new Error(
				"Credentials file does not contain a 'wordpress' section",
			);
		}
		const wp = config.wordpress as Record<string, unknown>;
		return {
			url: opts.url,
			username: requireField(wp, "username", "WordPress"),
			password: requireField(wp, "password", "WordPress"),
		};
	}

	// Direct options (passed from CLI after prompting)
	if (opts.username && opts.password) {
		return { url: opts.url, username: opts.username, password: opts.password };
	}

	throw new Error(
		"No credentials provided. Use --credentials-file or let the CLI prompt you.",
	);
}

export async function resolveWixCredentials(opts: {
	credentialsFile?: string;
	email?: string;
	password?: string;
}): Promise<WixCredentials> {
	if (opts.credentialsFile) {
		const config = await loadCredentialsFile(opts.credentialsFile);
		if (!config.wix) {
			throw new Error("Credentials file does not contain a 'wix' section");
		}
		const wix = config.wix as Record<string, unknown>;
		return {
			email: requireField(wix, "email", "Wix"),
			password: requireField(wix, "password", "Wix"),
		};
	}

	if (opts.email && opts.password) {
		return { email: opts.email, password: opts.password };
	}

	throw new Error(
		"No credentials provided. Use --credentials-file or let the CLI prompt you.",
	);
}
