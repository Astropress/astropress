import { describe, expect, it, vi } from "vitest";
import { createAstropressTaxonomyRepository } from "../src/taxonomy-repository-factory";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

function makeRepo(
	overrides: Partial<Parameters<typeof createAstropressTaxonomyRepository>[0]> = {},
) {
	const recordTaxonomyAudit = vi.fn();
	const createTaxonomyTerm = vi.fn(() => true);
	const updateTaxonomyTerm = vi.fn(() => true);
	const deleteTaxonomyTerm = vi.fn(() => true);
	const listCategories = vi.fn(() => []);
	const listTags = vi.fn(() => []);
	const slugifyTerm = (value: string) => value.toLowerCase().replace(/\s+/g, "-");
	const repository = createAstropressTaxonomyRepository({
		listCategories,
		listTags,
		slugifyTerm,
		createTaxonomyTerm,
		updateTaxonomyTerm,
		deleteTaxonomyTerm,
		recordTaxonomyAudit,
		...overrides,
	});
	return {
		repository,
		recordTaxonomyAudit,
		createTaxonomyTerm,
		updateTaxonomyTerm,
		deleteTaxonomyTerm,
		listCategories,
		listTags,
	};
}

describe("taxonomy repository factory — create", () => {
	it("dispatches createCategory to table=categories, kind=category and trims description", () => {
		const { repository, createTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.createCategory(
			{ name: "  Food Waste  ", slug: " Food Waste ", description: "  category body  " },
			actor,
		);
		expect(result).toEqual({ ok: true });
		expect(createTaxonomyTerm).toHaveBeenCalledWith({
			table: "categories",
			slug: "food-waste",
			name: "Food Waste",
			description: "category body",
		});
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "category.create",
			summary: "Created category Food Waste.",
			targetId: "food-waste",
		});
	});

	it("dispatches createTag to table=tags, kind=tag with empty default description", () => {
		const { repository, createTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.createTag({ name: "Urban Farming" }, actor);
		expect(result).toEqual({ ok: true });
		expect(createTaxonomyTerm).toHaveBeenCalledWith({
			table: "tags",
			slug: "urban-farming",
			name: "Urban Farming",
			description: "",
		});
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "tag.create",
			summary: "Created tag Urban Farming.",
			targetId: "urban-farming",
		});
	});

	it("rejects createCategory when name is blank (no audit, no insert)", () => {
		const { repository, createTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.createCategory({ name: "   ", description: "x" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "category name and slug are required.",
		});
		expect(createTaxonomyTerm).not.toHaveBeenCalled();
		expect(recordTaxonomyAudit).not.toHaveBeenCalled();
	});

	it("rejects createTag with the tag-kind error message when slug slugifies to empty", () => {
		const { repository } = makeRepo({ slugifyTerm: () => "" });
		const result = repository.createTag({ name: "Cooking" }, actor);
		expect(result).toEqual({ ok: false, error: "tag name and slug are required." });
	});

	it("returns the in-use error verbatim when createTaxonomyTerm returns false", () => {
		const { repository, recordTaxonomyAudit } = makeRepo({
			createTaxonomyTerm: vi.fn(() => false),
		});
		const result = repository.createCategory({ name: "Food" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "That category name or slug is already in use.",
		});
		expect(recordTaxonomyAudit).not.toHaveBeenCalled();
	});
});

describe("taxonomy repository factory — update", () => {
	it("dispatches updateCategory to table=categories, kind=category and trims description", () => {
		const { repository, updateTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.updateCategory(
			{ id: 9, name: "  Food Waste  ", slug: " Food Waste ", description: "  cat body  " },
			actor,
		);
		expect(result).toEqual({ ok: true });
		expect(updateTaxonomyTerm).toHaveBeenCalledWith({
			table: "categories",
			id: 9,
			slug: "food-waste",
			name: "Food Waste",
			description: "cat body",
		});
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "category.update",
			summary: "Updated category Food Waste.",
			targetId: "9",
		});
	});

	it("dispatches updateTag to table=tags, kind=tag with empty default description", () => {
		const { repository, updateTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.updateTag({ id: 4, name: "Urban Farming" }, actor);
		expect(result).toEqual({ ok: true });
		expect(updateTaxonomyTerm).toHaveBeenCalledWith({
			table: "tags",
			id: 4,
			slug: "urban-farming",
			name: "Urban Farming",
			description: "",
		});
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "tag.update",
			summary: "Updated tag Urban Farming.",
			targetId: "4",
		});
	});

	it("rejects updateCategory when id is zero", () => {
		const { repository, updateTaxonomyTerm } = makeRepo();
		const result = repository.updateCategory({ id: 0, name: "Food" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "category id, name, and slug are required.",
		});
		expect(updateTaxonomyTerm).not.toHaveBeenCalled();
	});

	it("rejects updateCategory when name trims to empty", () => {
		const { repository } = makeRepo();
		const result = repository.updateCategory({ id: 1, name: "  " }, actor);
		expect(result).toEqual({
			ok: false,
			error: "category id, name, and slug are required.",
		});
	});

	it("rejects updateTag when slug slugifies to empty", () => {
		const { repository } = makeRepo({ slugifyTerm: () => "" });
		const result = repository.updateTag({ id: 1, name: "X" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "tag id, name, and slug are required.",
		});
	});

	it("returns the could-not-be-updated error when updateTaxonomyTerm returns false", () => {
		const { repository, recordTaxonomyAudit } = makeRepo({
			updateTaxonomyTerm: vi.fn(() => false),
		});
		const result = repository.updateCategory({ id: 7, name: "Food" }, actor);
		expect(result).toEqual({
			ok: false,
			error: "That category could not be updated.",
		});
		expect(recordTaxonomyAudit).not.toHaveBeenCalled();
	});
});

describe("taxonomy repository factory — delete", () => {
	it("dispatches deleteCategory to table=categories, kind=category", () => {
		const { repository, deleteTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.deleteCategory(7, actor);
		expect(result).toEqual({ ok: true });
		expect(deleteTaxonomyTerm).toHaveBeenCalledWith({ table: "categories", id: 7 });
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "category.delete",
			summary: "Deleted category 7.",
			targetId: "7",
		});
	});

	it("dispatches deleteTag to table=tags, kind=tag", () => {
		const { repository, deleteTaxonomyTerm, recordTaxonomyAudit } = makeRepo();
		const result = repository.deleteTag(11, actor);
		expect(result).toEqual({ ok: true });
		expect(deleteTaxonomyTerm).toHaveBeenCalledWith({ table: "tags", id: 11 });
		expect(recordTaxonomyAudit).toHaveBeenCalledWith({
			actor,
			action: "tag.delete",
			summary: "Deleted tag 11.",
			targetId: "11",
		});
	});

	it("returns the could-not-be-deleted error when deleteTaxonomyTerm returns false", () => {
		const { repository, recordTaxonomyAudit } = makeRepo({
			deleteTaxonomyTerm: vi.fn(() => false),
		});
		const result = repository.deleteTag(99, actor);
		expect(result).toEqual({
			ok: false,
			error: "That tag could not be deleted.",
		});
		expect(recordTaxonomyAudit).not.toHaveBeenCalled();
	});
});

describe("taxonomy repository factory — list passthroughs", () => {
	it("forwards listCategories args and result", () => {
		const expected = [{ id: 1, slug: "a", name: "A", description: "", taxonomy_id: 1 }];
		const listCategories = vi.fn(() => expected);
		const { repository } = makeRepo({
			listCategories: listCategories as unknown as Parameters<
				typeof createAstropressTaxonomyRepository
			>[0]["listCategories"],
		});
		const result = repository.listCategories();
		expect(result).toBe(expected);
		expect(listCategories).toHaveBeenCalledTimes(1);
	});

	it("forwards listTags args and result", () => {
		const expected = [{ id: 2, slug: "b", name: "B", description: "", taxonomy_id: 2 }];
		const listTags = vi.fn(() => expected);
		const { repository } = makeRepo({
			listTags: listTags as unknown as Parameters<
				typeof createAstropressTaxonomyRepository
			>[0]["listTags"],
		});
		const result = repository.listTags();
		expect(result).toBe(expected);
		expect(listTags).toHaveBeenCalledTimes(1);
	});
});
