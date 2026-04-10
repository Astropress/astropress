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

export function handleHealthRequest(_request: Request): Response {
  const body: HealthStatus = {
    status: "ok",
    version: resolveVersion(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
