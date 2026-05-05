import { afterEach, describe, expect, test } from "vitest";

import {
	_resetAccessActionRegistryForTests,
	getAccessAction,
	listAccessActions,
	registerAccessAction,
} from "../src/access";

afterEach(() => {
	_resetAccessActionRegistryForTests();
});

describe("access action registry", () => {
	test("built-in actions are registered at module load", () => {
		const all = listAccessActions();
		expect(all.length).toBeGreaterThan(20);
		expect(getAccessAction("posts:edit")?.pluginId).toBe("core");
		expect(getAccessAction("roles:manage")?.pluginId).toBe("core");
	});

	test("plugin can register a new action", () => {
		registerAccessAction({
			id: "myplugin:doThing",
			description: "Do the thing",
			pluginId: "my-plugin",
		});
		expect(getAccessAction("myplugin:doThing")?.pluginId).toBe("my-plugin");
	});

	test("re-registering same id by same plugin is allowed (idempotent setup)", () => {
		registerAccessAction({
			id: "myplugin:thing",
			description: "v1",
			pluginId: "my-plugin",
		});
		expect(() =>
			registerAccessAction({
				id: "myplugin:thing",
				description: "v2 (updated)",
				pluginId: "my-plugin",
			}),
		).not.toThrow();
		expect(getAccessAction("myplugin:thing")?.description).toBe("v2 (updated)");
	});

	test("a different plugin cannot hijack an existing action id", () => {
		registerAccessAction({
			id: "myplugin:thing",
			description: "owned by my-plugin",
			pluginId: "my-plugin",
		});
		expect(() =>
			registerAccessAction({
				id: "myplugin:thing",
				description: "stolen",
				pluginId: "other-plugin",
			}),
		).toThrow(/already registered/);
	});

	test("listAccessActions returns alphabetically sorted IDs", () => {
		const ids = listAccessActions().map((a) => a.id);
		const sorted = [...ids].sort();
		expect(ids).toEqual(sorted);
	});

	test("_resetAccessActionRegistryForTests clears plugin actions and re-seeds built-ins", () => {
		registerAccessAction({
			id: "ephemeral:goAway",
			description: "ephemeral",
			pluginId: "ephemeral-plugin",
		});
		expect(getAccessAction("ephemeral:goAway")).toBeDefined();
		_resetAccessActionRegistryForTests();
		expect(getAccessAction("ephemeral:goAway")).toBeUndefined();
		expect(getAccessAction("posts:edit")?.pluginId).toBe("core");
	});
});
