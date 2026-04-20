const startTime = Date.now();

export interface HealthStatus {
	status: "ok" | "degraded";
	version: string;
	uptime: number;
	timestamp: string;
}

function resolveVersion(): string {
	try {
		// Resolved at runtime from the nearest package.json
		// biome-ignore lint/suspicious/noExplicitAny: dynamic require fallback
		const pkg = (globalThis as any).__ASTROPRESS_VERSION__;
		if (typeof pkg === "string") return pkg;
	} catch {
		// ignore
	}
	return "unknown";
}

type HealthCheckFn = () => Promise<void> | void;

let _healthCheck: HealthCheckFn | null = null;

export function registerHealthCheck(fn: HealthCheckFn): void {
	_healthCheck = fn;
}

export async function handleHealthRequest(
	_request: Request,
): Promise<Response> {
	let status: "ok" | "degraded" = "ok";
	if (_healthCheck) {
		try {
			await _healthCheck();
		} catch {
			status = "degraded";
		}
	}

	const body: HealthStatus = {
		status,
		version: resolveVersion(),
		uptime: Math.floor((Date.now() - startTime) / 1000),
		timestamp: new Date().toISOString(),
	};
	return new Response(JSON.stringify(body), {
		status: status === "ok" ? 200 : 503,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
}
