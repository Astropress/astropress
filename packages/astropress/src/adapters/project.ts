import type { AstropressPlatformAdapter } from "../platform-contracts";
import { resolveAstropressProjectEnvContract } from "../project-env";
import {
	type AstropressHostedAdapterOptions,
	createAstropressHostedAdapter,
} from "./hosted";
import {
	type AstropressLocalAdapterOptions,
	createAstropressLocalAdapter,
} from "./local";

export type AstropressProjectAdapterMode = "local" | "hosted";

export interface AstropressProjectAdapterOptions {
	mode?: AstropressProjectAdapterMode;
	env?: Record<string, string | undefined>;
	local?: AstropressLocalAdapterOptions;
	hosted?: AstropressHostedAdapterOptions;
}

export function resolveAstropressProjectAdapterMode(
	env: Record<string, string | undefined> = process.env,
): AstropressProjectAdapterMode {
	return env.ASTROPRESS_RUNTIME_MODE?.trim() === "hosted" ? "hosted" : "local";
}

export function createAstropressProjectAdapter(
	options: AstropressProjectAdapterOptions = {},
): AstropressPlatformAdapter {
	const env = options.env ?? process.env;
	const mode = options.mode ?? resolveAstropressProjectAdapterMode(env);
	const projectEnv = resolveAstropressProjectEnvContract(env);

	if (mode === "hosted") {
		return createAstropressHostedAdapter({
			env,
			provider: options.hosted?.provider ?? projectEnv.hostedProvider,
			...options.hosted,
		} as AstropressHostedAdapterOptions);
	}

	return createAstropressLocalAdapter({
		env,
		provider: options.local?.provider ?? projectEnv.localProvider,
		...options.local,
	});
}
