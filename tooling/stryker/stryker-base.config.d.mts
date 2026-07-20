// Declarations for stryker-base.config.mjs so TypeScript consumers
// (tooling/scripts/prepush-mutation-gate.ts) can read shared values without
// an implicit-any import.
export declare const strykerBase: {
	plugins: string[];
	testRunner: string;
	disableTypeChecks: boolean;
	timeoutMS: number;
	dryRunTimeoutMinutes: number;
};
