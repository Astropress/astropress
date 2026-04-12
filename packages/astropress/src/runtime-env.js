function importMetaEnv() {
    return import.meta.env;
}
export function getRuntimeEnv(name) {
    const key = String(name);
    return importMetaEnv()[key] ?? process.env[key];
}
export function isProductionRuntime() {
    return import.meta.env.PROD;
}
export function getCloudflareBindings(locals) {
    if (locals?.runtime && typeof locals.runtime === "object") {
        try {
            const runtimeEnv = locals.runtime.env;
            if (runtimeEnv) {
                return runtimeEnv;
            }
        }
        catch {
            // Astro v6 Cloudflare runtime removed Astro.locals.runtime.env.
            // Fall back to bindings imported from cloudflare:workers below.
        }
    }
    const globalBindings = globalThis.__astropressCloudflareBindings;
    return (globalBindings ?? {});
}
export function getStringRuntimeValue(name, locals) {
    const bindings = getCloudflareBindings(locals);
    return bindings[name] ?? getRuntimeEnv(name);
}
export function getNewsletterConfig(locals) {
    const mode = getStringRuntimeValue("NEWSLETTER_DELIVERY_MODE", locals) ?? (isProductionRuntime() ? "listmonk" : "mock");
    return {
        mode,
        listmonkApiUrl: getStringRuntimeValue("LISTMONK_API_URL", locals),
        listmonkApiUsername: getStringRuntimeValue("LISTMONK_API_USERNAME", locals),
        listmonkApiPassword: getStringRuntimeValue("LISTMONK_API_PASSWORD", locals),
        listmonkListId: getStringRuntimeValue("LISTMONK_LIST_ID", locals),
    };
}
export function getTransactionalEmailConfig(locals) {
    return {
        mode: getStringRuntimeValue("EMAIL_DELIVERY_MODE", locals) ?? "mock",
        apiKey: getStringRuntimeValue("RESEND_API_KEY", locals),
        from: getStringRuntimeValue("RESEND_FROM_EMAIL", locals),
        contactDestination: getStringRuntimeValue("CONTACT_NOTIFICATION_TO_EMAIL", locals),
    };
}
export function getAdminBootstrapConfig(locals) {
    const isPlaywright = Boolean(getRuntimeEnv("PLAYWRIGHT_E2E_MODE") ?? getRuntimeEnv("PLAYWRIGHT"));
    const adminPassword = getStringRuntimeValue("ADMIN_PASSWORD", locals) ?? (isPlaywright ? "ap-e2e-admin-password" : undefined);
    const editorPassword = getStringRuntimeValue("EDITOR_PASSWORD", locals) ?? (isPlaywright ? "ap-e2e-editor-password" : undefined);
    return {
        adminPassword,
        editorPassword,
        bootstrapDisabled: getStringRuntimeValue("ADMIN_BOOTSTRAP_DISABLED", locals) === "1",
        adminDbPath: getStringRuntimeValue("ADMIN_DB_PATH", locals),
        sessionSecret: getStringRuntimeValue("SESSION_SECRET", locals),
    };
}
export function getLoginSecurityConfig(locals) {
    const configuredMaxAttempts = Number(getStringRuntimeValue("LOGIN_MAX_ATTEMPTS", locals));
    const runningPlaywright = Boolean(getRuntimeEnv("PLAYWRIGHT_E2E_MODE"));
    const maxLoginAttempts = Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts > 0
        ? configuredMaxAttempts
        : isProductionRuntime() || runningPlaywright
            ? 5
            : 250;
    return {
        maxLoginAttempts,
        secureCookies: isProductionRuntime(),
        turnstileSiteKey: getStringRuntimeValue("PUBLIC_TURNSTILE_SITE_KEY", locals),
        turnstileSecretKey: getStringRuntimeValue("TURNSTILE_SECRET_KEY", locals),
    };
}
export function getTurnstileSiteKey(locals) {
    return getLoginSecurityConfig(locals).turnstileSiteKey;
}
