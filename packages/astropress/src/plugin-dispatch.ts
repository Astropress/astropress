// ─── Plugin Dispatch ──────────────────────────────────────────────────────────
// Extracted from config.ts to keep that file under the 400-line limit.

import type { AstropressContentEvent, AstropressMediaEvent } from "./cms-plugins";
import { peekCmsConfig } from "./config-store";

// Per-plugin diagnostic counters. Updated whenever a hook is run or an error
// is swallowed by the silent-swallow contract. Operators never see these
// (the contract to plugin authors is "we never fail your action because
// of you"); tests use them to assert that a hook actually ran and an error
// was actually swallowed without breaking that contract.
export interface PluginDispatchStats {
	hooksRun: number;
	errorsSwallowed: number;
}

const STATS = new Map<string, PluginDispatchStats>();

function recordHookRun(plugin: string): void {
	const entry = STATS.get(plugin) ?? { hooksRun: 0, errorsSwallowed: 0 };
	entry.hooksRun += 1;
	STATS.set(plugin, entry);
}

function recordErrorSwallowed(plugin: string): void {
	const entry = STATS.get(plugin) ?? { hooksRun: 0, errorsSwallowed: 0 };
	entry.errorsSwallowed += 1;
	STATS.set(plugin, entry);
}

/**
 * Read per-plugin diagnostic counters. Returns a snapshot keyed by plugin
 * name, with the number of hook invocations and the number of errors that
 * were silently swallowed by the dispatch layer. Mutating the returned
 * object does not affect internal state.
 */
export function getPluginDispatchStats(): Record<string, PluginDispatchStats> {
	const out: Record<string, PluginDispatchStats> = {};
	for (const [name, stats] of STATS.entries()) {
		out[name] = {
			hooksRun: stats.hooksRun,
			errorsSwallowed: stats.errorsSwallowed,
		};
	}
	return out;
}

/**
 * Reset every per-plugin diagnostic counter. Tests call this between cases
 * so assertions reflect only the events of the current test.
 */
export function resetPluginDispatchStats(): void {
	STATS.clear();
}

/**
 * Dispatch an error to all registered plugin `onError` hooks.
 * Called internally whenever a plugin hook or Astropress operation throws unexpectedly.
 * Errors thrown inside `onError` are silently swallowed.
 */
async function dispatchPluginError(error: Error, context: string): Promise<void> {
	const config = peekCmsConfig();
	if (!config?.plugins?.length) return;
	for (const plugin of config.plugins) {
		const fn = plugin.onError;
		if (typeof fn !== "function") continue;
		try {
			await fn(error, context);
			recordHookRun(plugin.name);
		} catch {
			// swallow — onError must never throw
			recordErrorSwallowed(plugin.name);
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
			recordHookRun(plugin.name);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			recordErrorSwallowed(plugin.name);
			console.error(`[astropress] Plugin "${plugin.name}" threw in ${hook}:`, err);
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
export async function dispatchPluginMediaEvent(event: AstropressMediaEvent): Promise<void> {
	const config = peekCmsConfig();
	if (!config?.plugins?.length) return;
	for (const plugin of config.plugins) {
		const fn = plugin.onMediaUpload;
		if (typeof fn !== "function") continue;
		try {
			await fn(event);
			recordHookRun(plugin.name);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			recordErrorSwallowed(plugin.name);
			console.error(`[astropress] Plugin "${plugin.name}" threw in onMediaUpload:`, err);
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
export async function reportAstropressError(error: unknown, context: string): Promise<void> {
	const err = error instanceof Error ? error : new Error(String(error));
	await dispatchPluginError(err, context);
}
