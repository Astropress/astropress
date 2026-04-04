import { env as cloudflareWorkersEnv } from "cloudflare:workers";
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
  MAILCHIMP_API_KEY?: string;
  MAILCHIMP_LIST_ID?: string;
  MAILCHIMP_SERVER?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CONTACT_NOTIFICATION_TO_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  NEWSLETTER_DELIVERY_MODE?: string;
  EMAIL_DELIVERY_MODE?: string;
  ADMIN_PASSWORD?: string;
  EDITOR_PASSWORD?: string;
  ADMIN_BOOTSTRAP_DISABLED?: string;
  ADMIN_DB_PATH?: string;
  SESSION_SECRET?: string;
  LOCAL_IMAGE_ROOT?: string;
}

type StringRuntimeKey = Exclude<keyof RuntimeBindings, "DB" | "MEDIA_BUCKET">;

function importMetaEnv() {
  return import.meta.env as Record<string, string | undefined>;
}

export function getRuntimeEnv(name: keyof RuntimeBindings | string) {
  const key = String(name);
  return importMetaEnv()[key] ?? process.env[key];
}

export function isProductionRuntime() {
  return import.meta.env.PROD;
}

export function getCloudflareBindings(locals?: App.Locals | null): RuntimeBindings {
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

  return (cloudflareWorkersEnv ?? {}) as RuntimeBindings;
}

export function getStringRuntimeValue(name: StringRuntimeKey, locals?: App.Locals | null) {
  const bindings = getCloudflareBindings(locals);
  return bindings[name] ?? getRuntimeEnv(name);
}

export function getNewsletterConfig(locals?: App.Locals | null) {
  const mode = getStringRuntimeValue("NEWSLETTER_DELIVERY_MODE", locals) ?? (isProductionRuntime() ? "mailchimp" : "mock");
  return {
    mode,
    apiKey: getStringRuntimeValue("MAILCHIMP_API_KEY", locals),
    listId: getStringRuntimeValue("MAILCHIMP_LIST_ID", locals),
    server: getStringRuntimeValue("MAILCHIMP_SERVER", locals),
  };
}

export function getTransactionalEmailConfig(locals?: App.Locals | null) {
  return {
    mode: getStringRuntimeValue("EMAIL_DELIVERY_MODE", locals) ?? "mock",
    apiKey: getStringRuntimeValue("RESEND_API_KEY", locals),
    from: getStringRuntimeValue("RESEND_FROM_EMAIL", locals),
    contactDestination: getStringRuntimeValue("CONTACT_NOTIFICATION_TO_EMAIL", locals),
  };
}

export function getAdminBootstrapConfig(locals?: App.Locals | null) {
  const adminPassword = getStringRuntimeValue("ADMIN_PASSWORD", locals) ?? (!isProductionRuntime() ? "fleet-test-admin-password" : undefined);
  const editorPassword = getStringRuntimeValue("EDITOR_PASSWORD", locals) ?? (!isProductionRuntime() ? "fleet-test-editor-password" : undefined);
  return {
    adminPassword,
    editorPassword,
    bootstrapDisabled: getStringRuntimeValue("ADMIN_BOOTSTRAP_DISABLED", locals) === "1",
    adminDbPath: getStringRuntimeValue("ADMIN_DB_PATH", locals),
    sessionSecret: getStringRuntimeValue("SESSION_SECRET", locals),
  };
}

export function getLoginSecurityConfig(locals?: App.Locals | null) {
  return {
    maxLoginAttempts: isProductionRuntime() ? 5 : 250,
    secureCookies: isProductionRuntime(),
    turnstileSiteKey: getStringRuntimeValue("PUBLIC_TURNSTILE_SITE_KEY", locals),
    turnstileSecretKey: getStringRuntimeValue("TURNSTILE_SECRET_KEY", locals),
  };
}

export function getTurnstileSiteKey(locals?: App.Locals | null) {
  return getLoginSecurityConfig(locals).turnstileSiteKey;
}
