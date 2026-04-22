import type { D1DatabaseLike } from "./d1-database";

export interface R2BucketLike {
	get(key: string): Promise<R2ObjectBodyLike | null>;
	put(
		key: string,
		value: ArrayBuffer | ArrayBufferView | string | Blob,
		options?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
	delete(key: string): Promise<void>;
}

export interface R2ObjectBodyLike {
	body?: ReadableStream | null;
	httpMetadata?: {
		contentType?: string;
	} | null;
	arrayBuffer?(): Promise<ArrayBuffer>;
}

export interface RuntimeBindings {
	DB?: D1DatabaseLike;
	MEDIA_BUCKET?: R2BucketLike;
	PUBLIC_R2_BASE_URL?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
	CONTACT_NOTIFICATION_TO_EMAIL?: string;
	TURNSTILE_SECRET_KEY?: string;
	PUBLIC_TURNSTILE_SITE_KEY?: string;
	NEWSLETTER_DELIVERY_MODE?: string;
	LISTMONK_API_URL?: string;
	LISTMONK_API_USERNAME?: string;
	LISTMONK_API_PASSWORD?: string;
	LISTMONK_LIST_ID?: string;
	EMAIL_DELIVERY_MODE?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_USERNAME?: string;
	SMTP_PASSWORD?: string;
	SMTP_FROM_EMAIL?: string;
	ADMIN_PASSWORD?: string;
	EDITOR_PASSWORD?: string;
	ADMIN_BOOTSTRAP_DISABLED?: string;
	ADMIN_DB_PATH?: string;
	ASTROPRESS_ROOT_SECRET?: string;
	ASTROPRESS_ROOT_SECRET_PREV?: string;
	SESSION_SECRET?: string;
	SESSION_SECRET_PREV?: string;
	CLOUDFLARE_SESSION_SECRET?: string;
	CLOUDFLARE_SESSION_SECRET_PREV?: string;
	LOCAL_IMAGE_ROOT?: string;
	LOGIN_MAX_ATTEMPTS?: string;
}

type StringRuntimeKey = Exclude<keyof RuntimeBindings, "DB" | "MEDIA_BUCKET">;

const LEGACY_RUNTIME_KEY_ALIASES: Partial<Record<StringRuntimeKey, string[]>> =
	{
		SESSION_SECRET: ["ASTROPRESS_SESSION_SECRET"],
		ADMIN_PASSWORD: ["ASTROPRESS_ADMIN_PASSWORD"],
		EDITOR_PASSWORD: ["ASTROPRESS_EDITOR_PASSWORD"],
	};

function importMetaEnv(): Record<string, string | undefined> {
	return (
		(
			import.meta as ImportMeta & {
				env?: Record<string, string | undefined>;
			}
		).env ?? {}
	);
}

function getRuntimeEnvValue(key: string) {
	return process.env[key] ?? importMetaEnv()[key];
}

function getUniqueConfiguredValues(...values: Array<string | undefined>) {
	const seen = new Set<string>();
	const configured: string[] = [];

	for (const value of values) {
		const trimmed = value?.trim();
		if (!trimmed || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		configured.push(trimmed);
	}

	return configured;
}

export function getRuntimeEnv(name: keyof RuntimeBindings | string) {
	const key = String(name);
	return getRuntimeEnvValue(key);
}

export function isProductionRuntime() {
	const value = getRuntimeEnvValue("PROD");
	return value === true || value === "true" || value === "1";
}

export function getCloudflareBindings(
	locals?: App.Locals | null,
): RuntimeBindings {
	if (locals?.runtime && typeof locals.runtime === "object") {
		try {
			const runtimeEnv = (locals.runtime as { env?: RuntimeBindings }).env;
			if (runtimeEnv) {
				return runtimeEnv;
			}
		} catch {
			// Astro v6 Cloudflare runtime removed Astro.locals.runtime.env.
			// Fall back to bindings imported from cloudflare:workers below.
		}
	}

	const globalBindings = (
		globalThis as typeof globalThis & {
			__astropressCloudflareBindings?: RuntimeBindings;
		}
	).__astropressCloudflareBindings;

	return (globalBindings ?? {}) as RuntimeBindings;
}

export function getStringRuntimeValue(
	name: StringRuntimeKey,
	locals?: App.Locals | null,
) {
	const bindings = getCloudflareBindings(locals);
	const value = bindings[name] ?? getRuntimeEnv(name);
	if (value != null) {
		return value;
	}

	const aliases = LEGACY_RUNTIME_KEY_ALIASES[name] ?? [];
	for (const alias of aliases) {
		const aliasValue = getRuntimeEnv(alias);
		if (aliasValue != null) {
			return aliasValue;
		}
	}

	return undefined;
}

export function getNewsletterConfig(locals?: App.Locals | null) {
	const mode =
		getStringRuntimeValue("NEWSLETTER_DELIVERY_MODE", locals) ??
		(isProductionRuntime() ? "listmonk" : "mock");
	return {
		mode,
		listmonkApiUrl: getStringRuntimeValue("LISTMONK_API_URL", locals),
		listmonkApiUsername: getStringRuntimeValue("LISTMONK_API_USERNAME", locals),
		listmonkApiPassword: getStringRuntimeValue("LISTMONK_API_PASSWORD", locals),
		listmonkListId: getStringRuntimeValue("LISTMONK_LIST_ID", locals),
	};
}

export function getTransactionalEmailConfig(locals?: App.Locals | null) {
	return {
		mode: getStringRuntimeValue("EMAIL_DELIVERY_MODE", locals) ?? "mock",
		resendApiKey: getStringRuntimeValue("RESEND_API_KEY", locals),
		resendFrom: getStringRuntimeValue("RESEND_FROM_EMAIL", locals),
		smtpHost: getStringRuntimeValue("SMTP_HOST", locals),
		smtpPort: getStringRuntimeValue("SMTP_PORT", locals),
		smtpUsername: getStringRuntimeValue("SMTP_USERNAME", locals),
		smtpPassword: getStringRuntimeValue("SMTP_PASSWORD", locals),
		smtpFrom: getStringRuntimeValue("SMTP_FROM_EMAIL", locals),
		contactDestination: getStringRuntimeValue(
			"CONTACT_NOTIFICATION_TO_EMAIL",
			locals,
		),
	};
}

export function getAstropressRootSecret(locals?: App.Locals | null) {
	return (
		getAstropressRootSecretCandidates(locals)[0] ?? "astropress-dev-root-secret"
	);
}

export function getAstropressRootSecretCandidates(locals?: App.Locals | null) {
	const currentRootSecret = getStringRuntimeValue(
		"ASTROPRESS_ROOT_SECRET",
		locals,
	);
	const currentSessionSecret = getStringRuntimeValue("SESSION_SECRET", locals);
	const previousRootSecret = getStringRuntimeValue(
		"ASTROPRESS_ROOT_SECRET_PREV",
		locals,
	);
	const previousSessionSecret = getStringRuntimeValue(
		"SESSION_SECRET_PREV",
		locals,
	);

	return getUniqueConfiguredValues(
		currentRootSecret ?? currentSessionSecret,
		previousRootSecret ?? previousSessionSecret,
	);
}

export function getAdminBootstrapConfig(locals?: App.Locals | null) {
	const isPlaywright = Boolean(
		getRuntimeEnv("PLAYWRIGHT_E2E_MODE") ?? getRuntimeEnv("PLAYWRIGHT"),
	);
	const adminPassword =
		getStringRuntimeValue("ADMIN_PASSWORD", locals) ??
		(isPlaywright ? "ap-e2e-admin-password" : undefined);
	const editorPassword =
		getStringRuntimeValue("EDITOR_PASSWORD", locals) ??
		(isPlaywright ? "ap-e2e-editor-password" : undefined);
	const rootSecretCandidates = getAstropressRootSecretCandidates(locals);
	return {
		adminPassword,
		editorPassword,
		bootstrapDisabled:
			getStringRuntimeValue("ADMIN_BOOTSTRAP_DISABLED", locals) === "1",
		adminDbPath: getStringRuntimeValue("ADMIN_DB_PATH", locals),
		rootSecret: rootSecretCandidates[0] ?? "astropress-dev-root-secret",
		rootSecretPrevious: rootSecretCandidates[1],
		sessionSecret: getStringRuntimeValue("SESSION_SECRET", locals),
		sessionSecretPrevious: getStringRuntimeValue("SESSION_SECRET_PREV", locals),
	};
}

export function getLoginSecurityConfig(locals?: App.Locals | null) {
	const configuredMaxAttempts = Number(
		getStringRuntimeValue("LOGIN_MAX_ATTEMPTS", locals),
	);
	const runningPlaywright = Boolean(getRuntimeEnv("PLAYWRIGHT_E2E_MODE"));
	const maxLoginAttempts =
		Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts > 0
			? configuredMaxAttempts
			: isProductionRuntime() || runningPlaywright
				? 5
				: 250;

	return {
		maxLoginAttempts,
		secureCookies: isProductionRuntime(),
		turnstileSiteKey: getStringRuntimeValue(
			"PUBLIC_TURNSTILE_SITE_KEY",
			locals,
		),
		turnstileSecretKey: getStringRuntimeValue("TURNSTILE_SECRET_KEY", locals),
	};
}

export function getTurnstileSiteKey(locals?: App.Locals | null) {
	return getLoginSecurityConfig(locals).turnstileSiteKey;
}
