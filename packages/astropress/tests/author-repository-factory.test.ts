import { describe, expect, it, vi } from "vitest";
import { createAstropressAuthorRepository } from "../src/author-repository-factory";

describe("author repository factory", () => {
	it("creates and deletes authors through package-owned repository assembly", () => {
		const recordAuthorAudit = vi.fn();
		const repository = createAstropressAuthorRepository({
			listAuthors: vi.fn(() => []),
			slugifyTerm(value) {
				return value.toLowerCase().replace(/\s+/g, "-");
			},
			createAuthor: vi.fn(() => true),
			updateAuthor: vi.fn(() => true),
			deleteAuthor: vi.fn(() => true),
			recordAuthorAudit,
		});

		expect(
			repository.createAuthor(
				{ name: "Alice Smith", bio: "Bio" },
				{ email: "admin@example.com", role: "admin", name: "Admin" },
			),
		).toEqual({ ok: true });

		expect(
			repository.updateAuthor(
				{ id: 4, name: "Alice Johnson", bio: "Updated" },
				{ email: "admin@example.com", role: "admin", name: "Admin" },
			),
		).toEqual({ ok: true });

		expect(
			repository.deleteAuthor(7, {
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			}),
		).toEqual({ ok: true });

		expect(recordAuthorAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "author.delete",
				targetId: "7",
			}),
		);
	});
});
