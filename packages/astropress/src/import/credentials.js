import { readFile, writeFile } from "node:fs/promises";

export function validateUrl(url) {
  if (!url || url.trim() === "") {
    throw new Error("URL is required");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL must include a protocol (https:// or http://)");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL must use http or https");
  }
}

export async function loadCredentialsFile(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw new Error(`Credentials file not found: ${filePath}`);
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Credentials file is not valid JSON: ${filePath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Credentials file must be a JSON object");
  }

  return parsed;
}

export async function saveCredentialsFile(filePath, config) {
  try {
    await writeFile(filePath, JSON.stringify(config, null, 2));
  } catch (err) {
    if (err && err.code === "EACCES") {
      throw new Error("Cannot write credentials file: permission denied");
    }
    throw err;
  }
}

function requireField(obj, field, context) {
  const value = obj[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} credentials are missing '${field}'`);
  }
  return value;
}

export async function resolveWordPressCredentials(opts) {
  if (opts.credentialsFile) {
    const config = await loadCredentialsFile(opts.credentialsFile);
    if (!config.wordpress) {
      throw new Error("Credentials file does not contain a 'wordpress' section");
    }
    return {
      url: opts.url,
      username: requireField(config.wordpress, "username", "WordPress"),
      password: requireField(config.wordpress, "password", "WordPress"),
    };
  }

  if (opts.username && opts.password) {
    return { url: opts.url, username: opts.username, password: opts.password };
  }

  throw new Error("No credentials provided. Use --credentials-file or let the CLI prompt you.");
}

export async function resolveWixCredentials(opts) {
  if (opts.credentialsFile) {
    const config = await loadCredentialsFile(opts.credentialsFile);
    if (!config.wix) {
      throw new Error("Credentials file does not contain a 'wix' section");
    }
    return {
      email: requireField(config.wix, "email", "Wix"),
      password: requireField(config.wix, "password", "Wix"),
    };
  }

  if (opts.email && opts.password) {
    return { email: opts.email, password: opts.password };
  }

  throw new Error("No credentials provided. Use --credentials-file or let the CLI prompt you.");
}
