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

export function handleHealthRequest(_request) {
  const body = {
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
