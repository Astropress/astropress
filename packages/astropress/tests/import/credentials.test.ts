import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	readFile: fsMocks.readFile,
	writeFile: fsMocks.writeFile,
}));

import {
	loadCredentialsFile,
	resolveWixCredentials,
	resolveWordPressCredentials,
	saveCredentialsFile,
	validateUrl,
} from "../../src/import/credentials.js";

describe("loadCredentialsFile", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("parses a valid credentials file with wordpress section", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: {
					url: "https://mysite.com",
					username: "admin",
					password: "secret",
				},
			}),
		);
		const config = await loadCredentialsFile("/path/.credentials.json");
		expect(config.wordpress?.url).toBe("https://mysite.com");
		expect(config.wordpress?.username).toBe("admin");
		expect(config.wordpress?.password).toBe("secret");
	});

	it("parses a valid credentials file with wix section", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wix: { email: "user@example.com", password: "wixpassword" },
			}),
		);
		const config = await loadCredentialsFile("/path/.credentials.json");
		expect(config.wix?.email).toBe("user@example.com");
		expect(config.wix?.password).toBe("wixpassword");
	});

	it("parses a file containing both wordpress and wix sections", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: {
					url: "https://wp.example.com",
					username: "admin",
					password: "wp-secret",
				},
				wix: { email: "user@example.com", password: "wix-secret" },
			}),
		);
		const config = await loadCredentialsFile("/path/.credentials.json");
		expect(config.wordpress?.username).toBe("admin");
		expect(config.wix?.email).toBe("user@example.com");
	});

	it("throws a clear error when the file does not exist", async () => {
		fsMocks.readFile.mockRejectedValue(
			Object.assign(new Error("no such file"), { code: "ENOENT" }),
		);
		await expect(loadCredentialsFile("/path/.credentials.json")).rejects.toThrow(
			"Credentials file not found: /path/.credentials.json",
		);
	});

	it("throws a clear error when the file contains invalid JSON", async () => {
		fsMocks.readFile.mockResolvedValue("not valid json {{{");
		await expect(loadCredentialsFile("/path/.credentials.json")).rejects.toThrow(
			"Credentials file is not valid JSON",
		);
	});

	it("throws a clear error when the file is valid JSON but not an object", async () => {
		fsMocks.readFile.mockResolvedValue(JSON.stringify(["array", "not", "object"]));
		await expect(loadCredentialsFile("/path/.credentials.json")).rejects.toThrow(
			"Credentials file must be a JSON object",
		);
	});
});

describe("saveCredentialsFile", () => {
	beforeEach(() => vi.resetAllMocks());

	it("writes the credentials to the specified path as formatted JSON", async () => {
		fsMocks.writeFile.mockResolvedValue(undefined);
		await saveCredentialsFile("/path/.credentials.json", {
			wordpress: {
				url: "https://mysite.com",
				username: "admin",
				password: "secret",
			},
		});
		expect(fsMocks.writeFile).toHaveBeenCalledWith(
			"/path/.credentials.json",
			expect.stringContaining('"username": "admin"'),
		);
	});

	it("throws a clear error when the path is not writable", async () => {
		fsMocks.writeFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
		await expect(saveCredentialsFile("/protected/.credentials.json", {})).rejects.toThrow(
			"Cannot write credentials file: permission denied",
		);
	});
});

describe("validateUrl", () => {
	it("accepts valid https URLs", () => {
		expect(() => validateUrl("https://mysite.com")).not.toThrow();
		expect(() => validateUrl("https://mysite.com/blog")).not.toThrow();
	});

	it("accepts valid http URLs", () => {
		expect(() => validateUrl("http://localhost:8080")).not.toThrow();
	});

	it("rejects URLs without a protocol", () => {
		expect(() => validateUrl("mysite.com")).toThrow(
			"URL must include a protocol (https:// or http://)",
		);
	});

	it("rejects empty strings", () => {
		expect(() => validateUrl("")).toThrow("URL is required");
	});

	it("rejects URLs with unsupported protocols", () => {
		expect(() => validateUrl("ftp://mysite.com")).toThrow("URL must use http or https");
	});
});

describe("resolveWordPressCredentials — credentials file path provided", () => {
	beforeEach(() => vi.resetAllMocks());

	it("reads credentials from the file when a credentials-file path is given", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: {
					url: "https://mysite.com",
					username: "admin",
					password: "file-secret",
				},
			}),
		);
		const creds = await resolveWordPressCredentials({
			url: "https://mysite.com",
			credentialsFile: "/path/.credentials.json",
		});
		expect(creds.username).toBe("admin");
		expect(creds.password).toBe("file-secret");
	});

	it("throws if the credentials file is missing the wordpress section", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({ wix: { email: "x@x.com", password: "y" } }),
		);
		await expect(
			resolveWordPressCredentials({
				url: "https://mysite.com",
				credentialsFile: "/path/.credentials.json",
			}),
		).rejects.toThrow("Credentials file does not contain a 'wordpress' section");
	});

	it("throws if the wordpress section is missing username or password", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: { url: "https://mysite.com", username: "admin" },
			}),
		);
		await expect(
			resolveWordPressCredentials({
				url: "https://mysite.com",
				credentialsFile: "/path/.credentials.json",
			}),
		).rejects.toThrow("WordPress credentials are missing 'password'");
	});
});

describe("resolveWixCredentials — credentials file path provided", () => {
	beforeEach(() => vi.resetAllMocks());

	it("reads email and password from the wix section", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({ wix: { email: "me@example.com", password: "wixpass" } }),
		);
		const creds = await resolveWixCredentials({
			credentialsFile: "/path/.credentials.json",
		});
		expect(creds.email).toBe("me@example.com");
		expect(creds.password).toBe("wixpass");
	});

	it("throws if the wix section is missing email", async () => {
		fsMocks.readFile.mockResolvedValue(JSON.stringify({ wix: { password: "wixpass" } }));
		await expect(
			resolveWixCredentials({ credentialsFile: "/path/.credentials.json" }),
		).rejects.toThrow("Wix credentials are missing 'email'");
	});

	it("throws if the wix section is missing password", async () => {
		fsMocks.readFile.mockResolvedValue(JSON.stringify({ wix: { email: "x@example.com" } }));
		await expect(
			resolveWixCredentials({ credentialsFile: "/path/.credentials.json" }),
		).rejects.toThrow("Wix credentials are missing 'password'");
	});

	it("returns email + password directly when no credentialsFile is provided", async () => {
		const creds = await resolveWixCredentials({
			email: "me@example.com",
			password: "direct-pw",
		});
		expect(creds).toEqual({ email: "me@example.com", password: "direct-pw" });
		expect(fsMocks.readFile).not.toHaveBeenCalled();
	});

	it("throws the no-credentials error when neither file nor email+password are provided", async () => {
		await expect(resolveWixCredentials({})).rejects.toThrow(
			"No credentials provided. Use --credentials-file or let the CLI prompt you.",
		);
	});

	it("throws the no-credentials error when password is provided but email is missing", async () => {
		await expect(resolveWixCredentials({ password: "x" })).rejects.toThrow(
			"No credentials provided. Use --credentials-file or let the CLI prompt you.",
		);
	});
});

describe("resolveWordPressCredentials — direct options and missing-credentials path", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns url + username + password directly when no credentialsFile is provided", async () => {
		const creds = await resolveWordPressCredentials({
			url: "https://mysite.com",
			username: "admin",
			password: "direct-pw",
		});
		expect(creds).toEqual({
			url: "https://mysite.com",
			username: "admin",
			password: "direct-pw",
		});
		expect(fsMocks.readFile).not.toHaveBeenCalled();
	});

	it("throws the no-credentials error when neither file nor username+password are provided", async () => {
		await expect(resolveWordPressCredentials({ url: "https://mysite.com" })).rejects.toThrow(
			"No credentials provided. Use --credentials-file or let the CLI prompt you.",
		);
	});

	it("throws if the wordpress section is missing username", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: { url: "https://mysite.com", password: "secret" },
			}),
		);
		await expect(
			resolveWordPressCredentials({
				url: "https://mysite.com",
				credentialsFile: "/path/.credentials.json",
			}),
		).rejects.toThrow("WordPress credentials are missing 'username'");
	});

	it("throws if the wordpress username is whitespace-only (requireField rejects after trim)", async () => {
		fsMocks.readFile.mockResolvedValue(
			JSON.stringify({
				wordpress: { url: "https://mysite.com", username: "   ", password: "secret" },
			}),
		);
		await expect(
			resolveWordPressCredentials({
				url: "https://mysite.com",
				credentialsFile: "/path/.credentials.json",
			}),
		).rejects.toThrow("WordPress credentials are missing 'username'");
	});
});

describe("validateUrl — whitespace + non-Error rejections", () => {
	it("rejects whitespace-only URLs with the URL-required error", () => {
		expect(() => validateUrl("   ")).toThrow("URL is required");
	});

	it("rejects null/undefined-like inputs with the URL-required error (no trim crash)", () => {
		// cast to satisfy the type — the runtime guard must short-circuit on falsy values
		expect(() => validateUrl(null as unknown as string)).toThrow("URL is required");
		expect(() => validateUrl(undefined as unknown as string)).toThrow("URL is required");
	});
});

describe("loadCredentialsFile — uses utf8 encoding and propagates non-ENOENT rejections", () => {
	beforeEach(() => vi.resetAllMocks());

	it("reads with utf8 encoding (not the empty string)", async () => {
		fsMocks.readFile.mockResolvedValue("{}");
		await loadCredentialsFile("/path/.credentials.json");
		expect(fsMocks.readFile).toHaveBeenCalledWith("/path/.credentials.json", "utf8");
	});

	it("propagates non-ENOENT Error rejections verbatim (no remap to not-found message)", async () => {
		fsMocks.readFile.mockRejectedValue(
			Object.assign(new Error("EACCES denied"), { code: "EACCES" }),
		);
		await expect(loadCredentialsFile("/p.json")).rejects.toThrow("EACCES denied");
	});

	it("propagates non-Error rejections verbatim", async () => {
		fsMocks.readFile.mockRejectedValue("string-rejection");
		await expect(loadCredentialsFile("/p.json")).rejects.toBe("string-rejection");
	});

	it("rejects JSON null as a non-object payload", async () => {
		fsMocks.readFile.mockResolvedValue("null");
		await expect(loadCredentialsFile("/p.json")).rejects.toThrow(
			"Credentials file must be a JSON object",
		);
	});

	it("rejects JSON numbers as a non-object payload", async () => {
		fsMocks.readFile.mockResolvedValue("42");
		await expect(loadCredentialsFile("/p.json")).rejects.toThrow(
			"Credentials file must be a JSON object",
		);
	});
});

describe("saveCredentialsFile — propagates non-EACCES rejections verbatim", () => {
	beforeEach(() => vi.resetAllMocks());

	it("propagates a generic Error rejection without remapping to permission-denied", async () => {
		fsMocks.writeFile.mockRejectedValue(new Error("disk full"));
		await expect(saveCredentialsFile("/p.json", {})).rejects.toThrow("disk full");
	});

	it("propagates a non-Error rejection verbatim", async () => {
		fsMocks.writeFile.mockRejectedValue("string-rejection");
		await expect(saveCredentialsFile("/p.json", {})).rejects.toBe("string-rejection");
	});
});
