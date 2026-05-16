// stryker-disable-file: data-only — module-level default include-list that
// caches through the vitest worker pool (static mutants survive regardless of
// test coverage). The behavioural caller in git.ts is mutation-tested at ≥95%
// and exercises the default list.

export const defaultEntries = [
	"package.json",
	"astro.config.mjs",
	"src",
	"public",
	"content",
	"db",
	"tests",
];
