// ─── Plugin Dispatch ──────────────────────────────────────────────────────────
// Extracted from config.ts to keep that file under the 400-line limit.

import { peekCmsConfig } from "./config";
import type { AstropressContentEvent, AstropressMediaEvent } from "./cms-plugins";

/**
 * Dispatch a content lifecycle event to all registered plugin hooks.
 *
 * Called internally after content saves and publishes. Errors thrown by
 * individual plugin hooks are caught and logged; they never fail the action.
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
      // Plugin errors must not propagate — they would fail the admin action.
      // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
      console.error(`[astropress] Plugin "${plugin.name}" threw in ${hook}:`, err);
    }
  }
}

/**
 * Dispatch a media upload event to all registered plugin hooks.
 *
 * Called internally after a media asset is successfully stored. Errors thrown by
 * individual plugin hooks are caught and logged; they never fail the upload action.
 */
export async function dispatchPluginMediaEvent(event: AstropressMediaEvent): Promise<void> {
  const config = peekCmsConfig();
  if (!config?.plugins?.length) return;
  for (const plugin of config.plugins) {
    const fn = plugin.onMediaUpload;
    if (typeof fn !== "function") continue;
    try {
      await fn(event);
    } catch (err) {
      // Plugin errors must not propagate — they would fail the upload action.
      // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
      console.error(`[astropress] Plugin "${plugin.name}" threw in onMediaUpload:`, err);
    }
  }
}
