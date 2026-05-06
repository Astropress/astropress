/**
 * Registry of action IDs the platform knows about.
 *
 * Built-in actions are registered at module load (their static catalogue
 * lives in `action-registry-data.ts`). Plugins call `registerAccessAction()`
 * from their setup code so their custom permissions appear in the
 * role-builder action picker, audit logs, and the "My Permissions" view.
 *
 * Action IDs are colon-namespaced strings: `<resource>:<verb>` (e.g.
 * `posts:edit`). Subscopes are encoded in the verb (`posts:delete.any` vs
 * `posts:delete.own`) — the policy engine does not interpret these,
 * but UI pickers can group them.
 */

import { BUILT_IN_ACCESS_ACTIONS } from "./action-registry-data";
import type { ActionDefinition } from "./types";

const registry = new Map<string, ActionDefinition>();

export function registerAccessAction(def: ActionDefinition): void {
	if (registry.has(def.id) && registry.get(def.id)?.pluginId !== def.pluginId) {
		throw new Error(
			`Access action "${def.id}" is already registered by plugin "${
				registry.get(def.id)?.pluginId
			}". Plugins cannot redeclare actions owned by others.`,
		);
	}
	registry.set(def.id, def);
}

export function getAccessAction(id: string): ActionDefinition | undefined {
	return registry.get(id);
}

export function listAccessActions(): readonly ActionDefinition[] {
	return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Test helper. Do not call in production code. */
export function _resetAccessActionRegistryForTests(): void {
	registry.clear();
	registerBuiltInActions();
}

function registerBuiltInActions(): void {
	for (const def of BUILT_IN_ACCESS_ACTIONS) registry.set(def.id, def);
}

registerBuiltInActions();
