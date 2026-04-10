import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getCmsConfig } from "../config.js";

function normalizeStructuredTemplateKey(value) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    return getCmsConfig().templateKeys.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function localeFromPath(pathname) {
  let locales;
  try {
    locales = getCmsConfig().locales ?? ["en", "es"];
  } catch {
    locales = ["en", "es"];
  }
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) return locale;
  }
  return locales[0] ?? "en";
}

function getSeedPageRecords() {
  try {
    return getCmsConfig().seedPages;
  } catch {
    return [];
  }
}

function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPasswordSync(password, iterations = 1e5) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function verifyPasswordSync(password, storedHash) {
  const [iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsText, 10);
  if (!iterations || !saltText || !hashText) {
    return false;
  }
  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  /* v8 ignore next 3 */
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function normalizePath(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  /* v8 ignore next 1 */
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function slugifyTerm(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeContentStatus(input) {
  if (input === "draft" || input === "review" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}

function parseIdList(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  /* v8 ignore next 3 */
  } catch {
    return [];
  }
}

function serializeIdList(values) {
  return JSON.stringify((values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b));
}

function parseSystemSettings(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
  /* v8 ignore next 1 */
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeSystemRoutePath(pathname) {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function localeFromAcceptLanguage(acceptLanguage) {
  let locales;
  try {
    locales = getCmsConfig().locales ?? ["en", "es"];
  } catch {
    locales = ["en", "es"];
  }
  if (!acceptLanguage) return locales[0] ?? "en";
  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";");
      const q = qPart ? Number(qPart.trim().replace("q=", "")) : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of entries) {
    const matched = locales.find((l) => l.toLowerCase() === tag || tag.startsWith(`${l.toLowerCase()}-`));
    if (matched) return matched;
  }
  return locales[0] ?? "en";
}

export {
  normalizeStructuredTemplateKey,
  localeFromPath,
  localeFromAcceptLanguage,
  getSeedPageRecords,
  hashOpaqueToken,
  hashPasswordSync,
  verifyPasswordSync,
  normalizePath,
  slugifyTerm,
  normalizeContentStatus,
  parseIdList,
  serializeIdList,
  parseSystemSettings,
  normalizeSystemRoutePath,
};
