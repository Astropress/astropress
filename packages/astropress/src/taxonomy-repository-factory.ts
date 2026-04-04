import type { Actor, TaxonomyKind, TaxonomyRepository } from "./persistence-types";

type TaxonomyTable = "categories" | "tags";

export interface AstropressTaxonomyRepositoryInput {
  listCategories: TaxonomyRepository["listCategories"];
  listTags: TaxonomyRepository["listTags"];
  slugifyTerm(value: string): string;
  createTaxonomyTerm(input: {
    table: TaxonomyTable;
    slug: string;
    name: string;
    description: string;
  }): boolean;
  updateTaxonomyTerm(input: {
    table: TaxonomyTable;
    id: number;
    slug: string;
    name: string;
    description: string;
  }): boolean;
  deleteTaxonomyTerm(input: { table: TaxonomyTable; id: number }): boolean;
  recordTaxonomyAudit(input: {
    actor: Actor;
    action: `${TaxonomyKind}.create` | `${TaxonomyKind}.update` | `${TaxonomyKind}.delete`;
    summary: string;
    targetId: string;
  }): void;
}

function createTerm(
  input: AstropressTaxonomyRepositoryInput,
  table: TaxonomyTable,
  kind: TaxonomyKind,
  rawInput: { name: string; slug?: string; description?: string },
  actor: Actor,
) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!name || !slug) {
    return { ok: false as const, error: `${kind} name and slug are required.` };
  }

  const created = input.createTaxonomyTerm({
    table,
    slug,
    name,
    description: rawInput.description?.trim() ?? "",
  });
  if (!created) {
    return { ok: false as const, error: `That ${kind} name or slug is already in use.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.create`,
    summary: `Created ${kind} ${name}.`,
    targetId: slug,
  });
  return { ok: true as const };
}

function updateTerm(
  input: AstropressTaxonomyRepositoryInput,
  table: TaxonomyTable,
  kind: TaxonomyKind,
  rawInput: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!rawInput.id || !name || !slug) {
    return { ok: false as const, error: `${kind} id, name, and slug are required.` };
  }

  const updated = input.updateTaxonomyTerm({
    table,
    id: rawInput.id,
    slug,
    name,
    description: rawInput.description?.trim() ?? "",
  });
  if (!updated) {
    return { ok: false as const, error: `That ${kind} could not be updated.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.update`,
    summary: `Updated ${kind} ${name}.`,
    targetId: String(rawInput.id),
  });
  return { ok: true as const };
}

function deleteTerm(
  input: AstropressTaxonomyRepositoryInput,
  table: TaxonomyTable,
  kind: TaxonomyKind,
  id: number,
  actor: Actor,
) {
  const deleted = input.deleteTaxonomyTerm({ table, id });
  if (!deleted) {
    return { ok: false as const, error: `That ${kind} could not be deleted.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.delete`,
    summary: `Deleted ${kind} ${id}.`,
    targetId: String(id),
  });
  return { ok: true as const };
}

export function createAstropressTaxonomyRepository(
  input: AstropressTaxonomyRepositoryInput,
): TaxonomyRepository {
  return {
    listCategories: (...args) => input.listCategories(...args),
    listTags: (...args) => input.listTags(...args),
    createCategory: (rawInput, actor) => createTerm(input, "categories", "category", rawInput, actor),
    updateCategory: (rawInput, actor) => updateTerm(input, "categories", "category", rawInput, actor),
    deleteCategory: (id, actor) => deleteTerm(input, "categories", "category", id, actor),
    createTag: (rawInput, actor) => createTerm(input, "tags", "tag", rawInput, actor),
    updateTag: (rawInput, actor) => updateTerm(input, "tags", "tag", rawInput, actor),
    deleteTag: (id, actor) => deleteTerm(input, "tags", "tag", id, actor),
  };
}
