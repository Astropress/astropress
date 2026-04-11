const startTime = Date.now();

function resolveVersion() {
  try {
    const pkg = globalThis.__ASTROPRESS_VERSION__;
    if (typeof pkg === "string") return pkg;
  } catch {
    // ignore
  }
  return "unknown";
}

let _healthCheck = null;

export function registerHealthCheck(fn) {
  _healthCheck = fn;
}

export async function handleHealthRequest(_request) {
  let status = "ok";
  if (_healthCheck) {
    try {
      await _healthCheck();
    } catch {
      status = "degraded";
    }
  }

  const body = {
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
