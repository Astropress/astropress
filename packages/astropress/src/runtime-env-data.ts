// stryker-disable-file: data-only — pure legacy-alias lookup table, no runtime logic
import type { RuntimeBindings } from "./runtime-env";

type StringRuntimeKey = Exclude<keyof RuntimeBindings, "DB" | "MEDIA_BUCKET">;

export const LEGACY_RUNTIME_KEY_ALIASES: Partial<Record<StringRuntimeKey, string[]>> = {
	SESSION_SECRET: ["ASTROPRESS_SESSION_SECRET"],
	ADMIN_PASSWORD: ["ASTROPRESS_ADMIN_PASSWORD"],
	EDITOR_PASSWORD: ["ASTROPRESS_EDITOR_PASSWORD"],
};
