import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

// Mock the filesystem side effects so the build/dev hooks can be exercised
// without touching disk. Spread the originals so the integration's other
// imports keep working.
const { mkdirMock, copyFileMock, createReadStreamMock } = vi.hoisted(() => ({
	mkdirMock: vi.fn().mockResolvedValue(undefined),
	copyFileMock: vi.fn().mockResolvedValue(undefined),
	createReadStreamMock: vi.fn(() => ({ pipe: vi.fn() })),
}));
vi.mock("node:fs/promises", async (orig) => ({
	...(await orig<typeof import("node:fs/promises")>()),
	mkdir: mkdirMock,
	copyFile: copyFileMock,
}));
vi.mock("node:fs", async (orig) => ({
	...(await orig<typeof import("node:fs")>()),
	createReadStream: createReadStreamMock,
}));

import { createAstropressAdminAppIntegration } from "../src/admin-app-integration";

describe("astro:server:setup — dev CSS middleware", () => {
	it("serves each dev-serve route with the css headers and a file stream", () => {
		const integration = createAstropressAdminAppIntegration();
		const registered: Array<{ url: string; handler: (req: unknown, res: unknown) => void }> = [];
		const server = {
			middlewares: {
				use: (url: string, handler: (req: unknown, res: unknown) => void) =>
					registered.push({ url, handler }),
			},
		};
		integration.hooks["astro:server:setup"]?.({ server } as never);

		// One middleware per dev-serve route (/admin.css and /sections.css).
		expect(registered.map((r) => r.url)).toEqual(["/admin.css", "/sections.css"]);

		for (const { handler } of registered) {
			const res = { setHeader: vi.fn() };
			const pipe = vi.fn();
			createReadStreamMock.mockReturnValueOnce({ pipe });
			handler({}, res);
			expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/css; charset=utf-8");
			expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
			// The stylesheet file is streamed to the response.
			expect(createReadStreamMock).toHaveBeenLastCalledWith(expect.stringMatching(/\.css$/));
			expect(pipe).toHaveBeenCalledWith(res);
		}
	});
});

describe("astro:build:done — stylesheet copy into the build output", () => {
	it("mkdir -p's the out dir and copies each stylesheet into it", async () => {
		mkdirMock.mockClear();
		copyFileMock.mockClear();
		const integration = createAstropressAdminAppIntegration();
		// A virtual output path (fs is mocked, nothing is written to disk).
		const outUrl = pathToFileURL("/virtual/build-out/nested/dir/");
		await integration.hooks["astro:build:done"]?.({ dir: outUrl } as never);

		// Recursive so a not-yet-existing nested output path is created.
		expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining("/virtual/build-out"), {
			recursive: true,
		});
		// One copy per stylesheet, each landing on its basename inside the out dir.
		expect(copyFileMock).toHaveBeenCalledTimes(2);
		const targets = copyFileMock.mock.calls.map((c) => c[1] as string);
		expect(targets).toEqual([
			"/virtual/build-out/nested/dir/admin.css",
			"/virtual/build-out/nested/dir/sections.css",
		]);
		for (const call of copyFileMock.mock.calls) {
			expect((call[0] as string).endsWith(".css")).toBe(true);
		}
	});
});
