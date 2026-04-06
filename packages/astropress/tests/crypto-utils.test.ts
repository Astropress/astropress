import { describe, expect, it } from "vitest";
import { createSessionTokenDigest } from "../src/crypto-utils.js";

describe("session token digest", () => {
  it("produces a deterministic hex digest that does not equal the raw token", async () => {
    const token = "session-token";
    const secret = "replace-with-a-long-random-session-secret";

    const first = await createSessionTokenDigest(token, secret);
    const second = await createSessionTokenDigest(token, secret);

    expect(first).toBe(second);
    expect(first).not.toBe(token);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
