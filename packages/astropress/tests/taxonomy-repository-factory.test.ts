import { describe, expect, it, vi } from "vitest";
import { createAstropressTaxonomyRepository } from "../src/taxonomy-repository-factory";

describe("taxonomy repository factory", () => {
  it("creates and deletes taxonomy terms through package-owned repository assembly", () => {
    const recordTaxonomyAudit = vi.fn();
    const repository = createAstropressTaxonomyRepository({
      listCategories: vi.fn(() => []),
      listTags: vi.fn(() => []),
      slugifyTerm(value) {
        return value.toLowerCase().replace(/\s+/g, "-");
      },
      createTaxonomyTerm: vi.fn(() => true),
      updateTaxonomyTerm: vi.fn(() => true),
      deleteTaxonomyTerm: vi.fn(() => true),
      recordTaxonomyAudit,
    });

    const created = repository.createCategory(
      { name: "Food Waste", description: "Category" },
      { email: "admin@example.com", role: "admin", name: "Admin" },
    );

    expect(created).toEqual({ ok: true });

    const updated = repository.updateTag(
      { id: 4, name: "Urban Farming", description: "Tag" },
      { email: "admin@example.com", role: "admin", name: "Admin" },
    );

    expect(updated).toEqual({ ok: true });

    const deleted = repository.deleteCategory(7, {
      email: "admin@example.com",
      role: "admin",
      name: "Admin",
    });

    expect(deleted).toEqual({ ok: true });
    expect(recordTaxonomyAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category.delete",
        targetId: "7",
      }),
    );
  });
});
