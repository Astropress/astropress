import { createD1AdminMutationStore } from "./d1-admin-store";
import type { Actor } from "./persistence-types";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { recordD1Audit } from "./d1-audit";

export async function createRuntimeAuthor(input: { name: string; slug?: string; bio?: string }, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).authors.createAuthor(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "author.create", "content", input.slug ?? input.name, `Created author ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createAuthor(input, actor),
  );
}

export async function updateRuntimeAuthor(
  input: { id: number; name: string; slug?: string; bio?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).authors.updateAuthor(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "author.update", "content", String(input.id), `Updated author ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.updateAuthor(input, actor),
  );
}

export async function deleteRuntimeAuthor(id: number, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).authors.deleteAuthor(id);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "author.delete", "content", String(id), `Deleted author ${id}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.deleteAuthor(id, actor),
  );
}

export async function createRuntimeCategory(
  input: { name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.createCategory(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "category.create", "content", input.slug ?? input.name, `Created category ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createCategory(input, actor),
  );
}

export async function updateRuntimeCategory(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.updateCategory(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "category.update", "content", String(input.id), `Updated category ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.updateCategory(input, actor),
  );
}

export async function deleteRuntimeCategory(id: number, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.deleteCategory(id);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "category.delete", "content", String(id), `Deleted category ${id}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.deleteCategory(id, actor),
  );
}

export async function createRuntimeTag(input: { name: string; slug?: string; description?: string }, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.createTag(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "tag.create", "content", input.slug ?? input.name, `Created tag ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createTag(input, actor),
  );
}

export async function updateRuntimeTag(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.updateTag(input);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "tag.update", "content", String(input.id), `Updated tag ${input.name.trim()}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.updateTag(input, actor),
  );
}

export async function deleteRuntimeTag(id: number, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const result = await createD1AdminMutationStore(db).taxonomies.deleteTag(id);
      if (!result.ok) return result;
      await recordD1Audit(locals, actor, "tag.delete", "content", String(id), `Deleted tag ${id}.`);
      return result;
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.deleteTag(id, actor),
  );
}
