import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

type ServerHandle = {
	name: string;
	process: ChildProcess;
};

function spawnCommand(
	name: string,
	command: string,
	args: string[],
	cwd: string,
	env?: NodeJS.ProcessEnv,
): ServerHandle {
	const child = spawn(command, args, {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
		env: {
			...process.env,
			...env,
		},
	});

	child.stdout?.on("data", (chunk) =>
		process.stdout.write(`[${name}] ${chunk}`),
	);
	child.stderr?.on("data", (chunk) =>
		process.stderr.write(`[${name}] ${chunk}`),
	);

	return { name, process: child };
}

async function waitForServer(url: string, timeoutMs = 120_000) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				return;
			}
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`Timed out waiting for ${url}`);
}

async function warmRoutes(baseUrl: string, paths: string[]) {
	const failures: string[] = [];
	for (const path of paths) {
		// Follow redirects (some admin routes redirect for feature-gating reasons).
		const response = await fetch(`${baseUrl}${path}`);
		if (!response.ok) {
			failures.push(`${path}: HTTP ${response.status}`);
		}
	}
	if (failures.length > 0) {
		throw new Error(
			`Route warming failed — ${failures.length} route(s) did not return OK:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
		);
	}
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	env?: NodeJS.ProcessEnv,
) {
	const child = spawn(command, args, {
		cwd,
		stdio: "inherit",
		env: {
			...process.env,
			...env,
		},
	});

	const exitCode = await new Promise<number>((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code) => resolve(code ?? 1));
	});

	if (exitCode !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} exited with code ${exitCode}`,
		);
	}
}

async function stopServer(handle: ServerHandle) {
	if (handle.process.exitCode !== null) {
		return;
	}

	if (handle.process.pid) {
		try {
			process.kill(-handle.process.pid, "SIGTERM");
		} catch {
			handle.process.kill("SIGTERM");
		}
	} else {
		handle.process.kill("SIGTERM");
	}
	await new Promise((resolve) => setTimeout(resolve, 500));

	if (handle.process.exitCode === null) {
		if (handle.process.pid) {
			try {
				process.kill(-handle.process.pid, "SIGKILL");
			} catch {
				handle.process.kill("SIGKILL");
			}
		} else {
			handle.process.kill("SIGKILL");
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}

async function findAvailablePort(preferredPort: number) {
	const maxAttempts = 20;
	for (
		let port = preferredPort;
		port < preferredPort + maxAttempts;
		port += 1
	) {
		const available = await new Promise<boolean>((resolve) => {
			const server = net.createServer();
			server.once("error", () => resolve(false));
			server.listen(port, "127.0.0.1", () => {
				server.close(() => resolve(true));
			});
		});

		if (available) {
			return port;
		}
	}

	throw new Error(`Unable to find an open port starting at ${preferredPort}`);
}

async function main() {
	const root = process.cwd();
	const requestedProjects = process.argv.slice(2);
	const needsExample =
		requestedProjects.length === 0 ||
		requestedProjects.some((arg) => arg.includes("example-a11y"));
	const needsAdminHarness =
		requestedProjects.length === 0 ||
		requestedProjects.some((arg) => arg.includes("admin-harness"));
	const servers: ServerHandle[] = [];
	const tempDataRoots: string[] = [];

	try {
		if (needsExample) {
			const exampleDataRoot = await mkdtemp(
				path.join(tmpdir(), "astropress-example-data-"),
			);
			tempDataRoots.push(exampleDataRoot);
			const examplePort = await findAvailablePort(4173);
			await runCommand(
				"bun",
				["run", "--filter", "astropress-example-gh-pages", "build"],
				root,
				{
					ASTROPRESS_DATA_ROOT: exampleDataRoot,
					ASTROPRESS_LOCAL_IMAGE_ROOT: exampleDataRoot,
				},
			);
			const exampleServer = spawnCommand(
				"example-server",
				"python3",
				[
					"-m",
					"http.server",
					String(examplePort),
					"--directory",
					"examples/github-pages/dist",
				],
				root,
			);
			servers.push(exampleServer);
			process.env.PLAYWRIGHT_EXAMPLE_BASE_URL = `http://127.0.0.1:${examplePort}`;
			await waitForServer(process.env.PLAYWRIGHT_EXAMPLE_BASE_URL);
		}

		if (needsAdminHarness) {
			const adminDataRoot = await mkdtemp(
				path.join(tmpdir(), "astropress-admin-data-"),
			);
			tempDataRoots.push(adminDataRoot);
			const adminPort = await findAvailablePort(4325);
			const harnessServer = spawnCommand(
				"admin-harness",
				"bun",
				[
					"run",
					"--filter",
					"astropress-example-admin-harness",
					"dev",
					"--",
					"--host",
					"127.0.0.1",
					"--port",
					String(adminPort),
				],
				root,
				{
					PLAYWRIGHT_E2E_MODE: "admin-harness",
					ASTROPRESS_DATA_ROOT: adminDataRoot,
					ASTROPRESS_LOCAL_IMAGE_ROOT: adminDataRoot,
				},
			);
			servers.push(harnessServer);
			process.env.PLAYWRIGHT_ADMIN_BASE_URL = `http://127.0.0.1:${adminPort}`;
			await waitForServer(`${process.env.PLAYWRIGHT_ADMIN_BASE_URL}/ap-admin`);
			// Warm all static admin routes before Playwright tests run so that first-visit
			// latency doesn't cause flaky timeouts. Feature-gated routes (cms, fundraising,
			// host) redirect to /ap-admin when not configured — that's expected and OK.
			await warmRoutes(process.env.PLAYWRIGHT_ADMIN_BASE_URL, [
				"/ap-admin",
				"/ap-admin/posts",
				"/ap-admin/posts/new",
				"/ap-admin/pages",
				"/ap-admin/comments",
				"/ap-admin/redirects",
				"/ap-admin/users",
				"/ap-admin/media",
				"/ap-admin/archives",
				"/ap-admin/authors",
				"/ap-admin/taxonomies",
				"/ap-admin/seo",
				"/ap-admin/settings",
				"/ap-admin/services",
				"/ap-admin/system",
				"/ap-admin/api-tokens",
				"/ap-admin/translations",
				"/ap-admin/route-pages",
				"/ap-admin/webhooks",
				"/ap-admin/cms",
				"/ap-admin/host",
				"/ap-admin/login",
				"/ap-admin/reset-password",
			]);
		}

		await runCommand(
			"npx",
			[
				"playwright",
				"test",
				"--config",
				"tooling/e2e/playwright.config.ts",
				...requestedProjects,
			],
			root,
			{
				PLAYWRIGHT_EXAMPLE_BASE_URL: process.env.PLAYWRIGHT_EXAMPLE_BASE_URL,
				PLAYWRIGHT_ADMIN_BASE_URL: process.env.PLAYWRIGHT_ADMIN_BASE_URL,
			},
		);
	} finally {
		await Promise.allSettled(servers.map((server) => stopServer(server)));
		await Promise.allSettled(
			tempDataRoots.map((dir) => rm(dir, { recursive: true, force: true })),
		);
	}
}

await main();
