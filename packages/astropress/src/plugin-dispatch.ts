// ─── Plugin Dispatch ──────────────────────────────────────────────────────────
// Extracted from config.ts to keep that file under the 400-line limit.

import type {
	AstropressContentEvent,
	AstropressMediaEvent,
} from "./cms-plugins";
import { peekCmsConfig } from "./config-store";

/**
 * Dispatch an error to all registered plugin `onError` hooks.
 * Called internally whenever a plugin hook or Astropress operation throws unexpectedly.
 * Errors thrown inside `onError` are silently swallowed.
 */
async function dispatchPluginError(
	error: Error,
	context: string,
): Promise<void> {
	const config = peekCmsConfig();
	if (!config?.plugins?.length) return;
	for (const plugin of config.plugins) {
		const fn = plugin.onError;
		if (typeof fn !== "function") continue;
		try {
			await fn(error, context);
		} catch {
			// swallow — onError must never throw
		}
	}
}

/**
 * Dispatch a content lifecycle event to all registered plugin hooks.
 *
 * Called internally after content saves and publishes. Errors thrown by
 * individual plugin hooks are caught, forwarded to `onError`, and logged;
 * they never fail the action.
 */
export async function dispatchPluginContentEvent(
	hook: "onContentSave" | "onContentPublish",
	event: AstropressContentEvent,
): Promise<void> {
	const config = peekCmsConfig();
	if (!config?.plugins?.length) return;
	for (const plugin of config.plugins) {
		const fn = plugin[hook];
		if (typeof fn !== "function") continue;
		try {
			await fn(event);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			console.error(
				`[astropress] Plugin "${plugin.name}" threw in ${hook}:`,
				err,
			);
			await dispatchPluginError(error, `plugin:${plugin.name}`);
		}
	}
}

/**
 * Dispatch a media upload event to all registered plugin hooks.
 *
 * Called internally after a media asset is successfully stored. Errors thrown by
 * individual plugin hooks are caught, forwarded to `onError`, and logged;
 * they never fail the upload action.
 */
export async function dispatchPluginMediaEvent(
	event: AstropressMediaEvent,
): Promise<void> {
	const config = peekCmsConfig();
	if (!config?.plugins?.length) return;
	for (const plugin of config.plugins) {
		const fn = plugin.onMediaUpload;
		if (typeof fn !== "function") continue;
		try {
			await fn(event);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			console.error(
				`[astropress] Plugin "${plugin.name}" threw in onMediaUpload:`,
				err,
			);
			await dispatchPluginError(error, `plugin:${plugin.name}`);
		}
	}
}

/**
 * Report an error from a non-plugin Astropress operation to all `onError` plugin hooks.
 * Use this for unexpected errors in admin actions, background jobs, etc.
 *
 * @example
 * ```ts
 * try {
 *   await performOperation();
 * } catch (err) {
 *   await reportAstropressError(err, "content-save");
 *   throw err;
 * }
 * ```
 */
export async function reportAstropressError(
	error: unknown,
	context: string,
): Promise<void> {
	const err = error instanceof Error ? error : new Error(String(error));
	await dispatchPluginError(err, context);
}
