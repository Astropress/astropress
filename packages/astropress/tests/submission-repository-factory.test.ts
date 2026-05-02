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

	it("contact submission id has the documented 'contact-' prefix (kills empty-template-literal mutant)", () => {
		const insertContactSubmission = vi.fn();
		const repository = createAstropressSubmissionRepository({
			getContactSubmissions: vi.fn(() => []),
			insertContactSubmission,
			getTestimonials: vi.fn(() => []),
			insertTestimonial: vi.fn(),
			updateTestimonialStatus: vi.fn(() => ({ ok: true as const })),
		});

		const submitted = repository.submitContact({
			name: "x",
			email: "x@x",
			message: "m",
			submittedAt: "2025-01-01T00:00:00.000Z",
		});
		if (!submitted.ok) throw new Error("expected ok");
		expect(submitted.submission.id.startsWith("contact-")).toBe(true);
	});

	it("submitTestimonial creates a 'pending' testimonial and forwards it to insertTestimonial", () => {
		const insertTestimonial = vi.fn();
		const repository = createAstropressSubmissionRepository({
			getContactSubmissions: vi.fn(() => []),
			insertContactSubmission: vi.fn(),
			getTestimonials: vi.fn(() => []),
			insertTestimonial,
			updateTestimonialStatus: vi.fn(() => ({ ok: true as const })),
		});
		const result = repository.submitTestimonial({
			name: "n",
			email: "e",
			company: "c",
			role: "r",
			beforeState: "b",
			transformation: "t",
			specificResult: "s",
			consentToPublish: true,
			source: "footer-form",
			submittedAt: "2025-01-01T00:00:00.000Z",
		} as never);
		if (!result.ok) throw new Error("expected ok");
		expect(result.id.startsWith("testimonial-")).toBe(true);
		expect(insertTestimonial).toHaveBeenCalledTimes(1);
		const passed = insertTestimonial.mock.calls[0]?.[0] as {
			status: string;
			id: string;
			source: string;
		};
		expect(passed.status).toBe("pending");
		expect(passed.id).toBe(result.id);
		expect(passed.source).toBe("footer-form");
	});

	it("getTestimonials forwards args to the input adapter", () => {
		const getTestimonials = vi.fn(() => []);
		const repository = createAstropressSubmissionRepository({
			getContactSubmissions: vi.fn(() => []),
			insertContactSubmission: vi.fn(),
			getTestimonials,
			insertTestimonial: vi.fn(),
			updateTestimonialStatus: vi.fn(() => ({ ok: true as const })),
		});
		repository.getTestimonials("approved");
		expect(getTestimonials).toHaveBeenCalledWith("approved");
	});

	it("moderateTestimonial delegates to updateTestimonialStatus", () => {
		const updateTestimonialStatus = vi.fn(() => ({ ok: true as const }));
		const repository = createAstropressSubmissionRepository({
			getContactSubmissions: vi.fn(() => []),
			insertContactSubmission: vi.fn(),
			getTestimonials: vi.fn(() => []),
			insertTestimonial: vi.fn(),
			updateTestimonialStatus,
		});
		expect(repository.moderateTestimonial("id-1", "approved")).toEqual({
			ok: true,
		});
		expect(updateTestimonialStatus).toHaveBeenCalledWith("id-1", "approved");
	});
});
