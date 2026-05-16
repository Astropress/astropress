import { describe, expect, it, vi } from "vitest";
import { createAstropressAuthorRepository } from "../src/author-repository-factory";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

function makeRepo(overrides: Partial<Parameters<typeof createAstropressAuthorRepository>[0]> = {}) {
	const recordAuthorAudit = vi.fn();
	const createAuthor = vi.fn(() => true);
	const updateAuthor = vi.fn(() => true);
	const deleteAuthor = vi.fn(() => true);
	const listAuthors = vi.fn(() => []);
	const slugifyTerm = (value: string) => value.toLowerCase().replace(/\s+/g, "-");
	const repository = createAstropressAuthorRepository({
		listAuthors,
		slugifyTerm,
		createAuthor,
		updateAuthor,
		deleteAuthor,
		recordAuthorAudit,
		...overrides,
	});
	return { repository, recordAuthorAudit, createAuthor, updateAuthor, deleteAuthor, listAuthors };
}

describe("author repository factory — create", () => {
	it("trims name, slug, and bio and dispatches the audit", () => {
		const { repository, createAuthor, recordAuthorAudit } = makeRepo();
		const result = repository.createAuthor(
			{ name: "  Alice Smith  ", slug: " Alice Smith ", bio: "  bio body  " },
			actor,
		);
		expect(result).toEqual({ ok: true });
		expect(createAuthor).toHaveBeenCalledWith({
			slug: "alice-smith",
			name: "Alice Smith",
			bio: "bio body",
		});
		expect(recordAuthorAudit).toHaveBeenCalledWith({
			actor,
			action: "author.create",
			summary: "Created author Alice Smith.",
			targetId: "alice-smith",
		});
	});

	it("defaults bio to empty string when omitted", () => {
		const { repository, createAuthor } = makeRepo();
		repository.createAuthor({ name: "Bob" }, actor);
		expect(createAuthor).toHaveBeenCalledWith({ slug: "bob", name: "Bob", bio: "" });
	});

	it("rejects when name trims to empty", () => {
		const { repository, createAuthor, recordAuthorAudit } = makeRepo();
		const result = repository.createAuthor({ name: "   " }, actor);
		expect(result).toEqual({ ok: false, error: "Author name and slug are required." });
		expect(createAuthor).not.toHaveBeenCalled();
		expect(recordAuthorAudit).not.toHaveBeenCalled();
	});

	it("rejects when slug slugifies to empty", () => {
		const { repository } = makeRepo({ slugifyTerm: () => "" });
		const result = repository.createAuthor({ name: "Alice" }, actor);
		expect(result).toEqual({ ok: false, error: "Author name and slug are required." });
	});

	it("returns the in-use error verbatim when createAuthor returns false", () => {
		const { repository, recordAuthorAudit } = makeRepo({ createAuthor: vi.fn(() => false) });
		const result = repository.createAuthor({ name: "Alice" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "That author name or slug is already in use.",
		});
		expect(recordAuthorAudit).not.toHaveBeenCalled();
	});
});

describe("author repository factory — update", () => {
	it("trims name, slug, and bio and dispatches the audit with stringified id", () => {
		const { repository, updateAuthor, recordAuthorAudit } = makeRepo();
		const result = repository.updateAuthor(
			{ id: 9, name: "  Alice  ", slug: " Alice ", bio: "  bio  " },
			actor,
		);
		expect(result).toEqual({ ok: true });
		expect(updateAuthor).toHaveBeenCalledWith({
			id: 9,
			slug: "alice",
			name: "Alice",
			bio: "bio",
		});
		expect(recordAuthorAudit).toHaveBeenCalledWith({
			actor,
			action: "author.update",
			summary: "Updated author Alice.",
			targetId: "9",
		});
	});

	it("defaults bio to empty string when omitted on update", () => {
		const { repository, updateAuthor } = makeRepo();
		repository.updateAuthor({ id: 3, name: "Bob" }, actor);
		expect(updateAuthor).toHaveBeenCalledWith({ id: 3, slug: "bob", name: "Bob", bio: "" });
	});

	it("rejects when id is zero", () => {
		const { repository, updateAuthor } = makeRepo();
		const result = repository.updateAuthor({ id: 0, name: "Alice" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "Author id, name, and slug are required.",
		});
		expect(updateAuthor).not.toHaveBeenCalled();
	});

	it("rejects when name trims to empty on update", () => {
		const { repository } = makeRepo();
		const result = repository.updateAuthor({ id: 1, name: "   " }, actor);
		expect(result).toEqual({
			ok: false,
			error: "Author id, name, and slug are required.",
		});
	});

	it("rejects when slug slugifies to empty on update", () => {
		const { repository } = makeRepo({ slugifyTerm: () => "" });
		const result = repository.updateAuthor({ id: 1, name: "Alice" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "Author id, name, and slug are required.",
		});
	});

	it("returns the could-not-be-updated error when updateAuthor returns false", () => {
		const { repository, recordAuthorAudit } = makeRepo({ updateAuthor: vi.fn(() => false) });
		const result = repository.updateAuthor({ id: 7, name: "Alice" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "That author could not be updated.",
		});
		expect(recordAuthorAudit).not.toHaveBeenCalled();
	});
});

describe("author repository factory — delete", () => {
	it("calls deleteAuthor with the id and dispatches the audit", () => {
		const { repository, deleteAuthor, recordAuthorAudit } = makeRepo();
		const result = repository.deleteAuthor(7, actor);
		expect(result).toEqual({ ok: true });
		expect(deleteAuthor).toHaveBeenCalledWith(7);
		expect(recordAuthorAudit).toHaveBeenCalledWith({
			actor,
			action: "author.delete",
			summary: "Deleted author 7.",
			targetId: "7",
		});
	});

	it("returns the could-not-be-deleted error when deleteAuthor returns false", () => {
		const { repository, recordAuthorAudit } = makeRepo({ deleteAuthor: vi.fn(() => false) });
		const result = repository.deleteAuthor(99, actor);
		expect(result).toEqual({
			ok: false,
			error: "That author could not be deleted.",
		});
		expect(recordAuthorAudit).not.toHaveBeenCalled();
	});
});

describe("author repository factory — list passthrough", () => {
	it("forwards listAuthors result and call count", () => {
		const expected = [{ id: 1, slug: "a", name: "A", bio: "" }];
		const listAuthors = vi.fn(() => expected);
		const { repository } = makeRepo({
			listAuthors: listAuthors as unknown as Parameters<
				typeof createAstropressAuthorRepository
			>[0]["listAuthors"],
		});
		const result = repository.listAuthors();
		expect(result).toBe(expected);
		expect(listAuthors).toHaveBeenCalledTimes(1);
	});
});
