function createTerm(input, table, kind, rawInput, actor) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!name || !slug) {
    return { ok: false, error: `${kind} name and slug are required.` };
  }

  const created = input.createTaxonomyTerm({
    table,
    slug,
    name,
    description: rawInput.description?.trim() ?? "",
  });
  if (!created) {
    return { ok: false, error: `That ${kind} name or slug is already in use.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.create`,
    summary: `Created ${kind} ${name}.`,
    targetId: slug,
  });
  return { ok: true };
}

function updateTerm(input, table, kind, rawInput, actor) {
  const name = rawInput.name.trim();
  const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
  if (!rawInput.id || !name || !slug) {
    return { ok: false, error: `${kind} id, name, and slug are required.` };
  }

  const updated = input.updateTaxonomyTerm({
    table,
    id: rawInput.id,
    slug,
    name,
    description: rawInput.description?.trim() ?? "",
  });
  if (!updated) {
    return { ok: false, error: `That ${kind} could not be updated.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.update`,
    summary: `Updated ${kind} ${name}.`,
    targetId: String(rawInput.id),
  });
  return { ok: true };
}

function deleteTerm(input, table, kind, id, actor) {
  const deleted = input.deleteTaxonomyTerm({ table, id });
  if (!deleted) {
    return { ok: false, error: `That ${kind} could not be deleted.` };
  }

  input.recordTaxonomyAudit({
    actor,
    action: `${kind}.delete`,
    summary: `Deleted ${kind} ${id}.`,
    targetId: String(id),
  });
  return { ok: true };
}

export function createAstropressTaxonomyRepository(input) {
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
