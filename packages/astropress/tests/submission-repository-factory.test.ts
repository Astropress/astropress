import { describe, expect, it, vi } from "vitest";
import { createAstropressSubmissionRepository } from "../src/submission-repository-factory";

describe("submission repository factory", () => {
  it("submits and lists contact submissions through package-owned repository assembly", () => {
    const insertContactSubmission = vi.fn();
    const repository = createAstropressSubmissionRepository({
      getContactSubmissions: vi.fn(() => []),
      insertContactSubmission,
    });

    const submitted = repository.submitContact({
      name: "Alice",
      email: "alice@example.com",
      message: "Hello",
      submittedAt: "2025-01-01T00:00:00.000Z",
    });

    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      expect(submitted.submission.name).toBe("Alice");
      expect(submitted.submission.email).toBe("alice@example.com");
    }

    expect(insertContactSubmission).toHaveBeenCalledTimes(1);
    expect(repository.getContactSubmissions()).toEqual([]);
  });
});
