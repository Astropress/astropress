import { describe, expect, it } from "vitest";
import { handleHealthRequest } from "../src/runtime-health.js";

describe("runtime health endpoint", () => {
  it("returns 200 with JSON body containing status, uptime, and timestamp", async () => {
    const request = new Request("https://example.com/ap/health");
    const response = handleHealthRequest(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp as string).getTime()).toBeGreaterThan(0);
  });

  it("includes a version field in the response", async () => {
    const request = new Request("https://example.com/ap/health");
    const response = handleHealthRequest(request);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.version).toBe("string");
  });
});
