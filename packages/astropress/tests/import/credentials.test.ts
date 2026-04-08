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
  saveCredentialsFile,
  resolveWordPressCredentials,
  resolveWixCredentials,
  validateUrl,
} from "../../src/import/credentials.js";

describe("loadCredentialsFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses a valid credentials file with wordpress section", async () => {
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({
        wordpress: { url: "https://mysite.com", username: "admin", password: "secret" },
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
        wordpress: { url: "https://wp.example.com", username: "admin", password: "wp-secret" },
        wix: { email: "user@example.com", password: "wix-secret" },
      }),
    );
    const config = await loadCredentialsFile("/path/.credentials.json");
    expect(config.wordpress?.username).toBe("admin");
    expect(config.wix?.email).toBe("user@example.com");
  });

  it("throws a clear error when the file does not exist", async () => {
    fsMocks.readFile.mockRejectedValue(Object.assign(new Error("no such file"), { code: "ENOENT" }));
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
      wordpress: { url: "https://mysite.com", username: "admin", password: "secret" },
    });
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/path/.credentials.json",
      expect.stringContaining('"username": "admin"'),
    );
  });

  it("throws a clear error when the path is not writable", async () => {
    fsMocks.writeFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    await expect(
      saveCredentialsFile("/protected/.credentials.json", {}),
    ).rejects.toThrow("Cannot write credentials file: permission denied");
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
    expect(() => validateUrl("mysite.com")).toThrow("URL must include a protocol (https:// or http://)");
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
        wordpress: { url: "https://mysite.com", username: "admin", password: "file-secret" },
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
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ wix: { email: "x@x.com", password: "y" } }));
    await expect(
      resolveWordPressCredentials({ url: "https://mysite.com", credentialsFile: "/path/.credentials.json" }),
    ).rejects.toThrow("Credentials file does not contain a 'wordpress' section");
  });

  it("throws if the wordpress section is missing username or password", async () => {
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ wordpress: { url: "https://mysite.com", username: "admin" } }),
    );
    await expect(
      resolveWordPressCredentials({ url: "https://mysite.com", credentialsFile: "/path/.credentials.json" }),
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
});
