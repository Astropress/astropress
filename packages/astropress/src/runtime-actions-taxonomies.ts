import { createD1AdminMutationStore } from "./d1-admin-store";
import type { Actor } from "./persistence-types";
import { runTaxonomyMutation } from "./runtime-actions-taxonomies-helpers";

export async function createRuntimeAuthor(
	input: { name: string; slug?: string; bio?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).authors.createAuthor(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.createAuthor(input, actor),
		{
			action: "author.create",
			resourceId: input.slug ?? input.name,
			message: `Created author ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function updateRuntimeAuthor(
	input: { id: number; name: string; slug?: string; bio?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).authors.updateAuthor(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.updateAuthor(input, actor),
		{
			action: "author.update",
			resourceId: String(input.id),
			message: `Updated author ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function deleteRuntimeAuthor(id: number, actor: Actor, locals?: App.Locals | null) {
	return runTaxonomyMutation(
		locals,
		actor,
		async (db) => {
			await createD1AdminMutationStore(db).authors.deleteAuthor(id);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.deleteAuthor(id, actor),
		{
			action: "author.delete",
			resourceId: String(id),
			message: `Deleted author ${id}.`,
			onlyIfOk: false,
		},
	);
}

export async function createRuntimeCategory(
	input: { name: string; slug?: string; description?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).taxonomies.createCategory(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.createCategory(input, actor),
		{
			action: "category.create",
			resourceId: input.slug ?? input.name,
			message: `Created category ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function updateRuntimeCategory(
	input: { id: number; name: string; slug?: string; description?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).taxonomies.updateCategory(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.updateCategory(input, actor),
		{
			action: "category.update",
			resourceId: String(input.id),
			message: `Updated category ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function deleteRuntimeCategory(id: number, actor: Actor, locals?: App.Locals | null) {
	return runTaxonomyMutation(
		locals,
		actor,
		async (db) => {
			await createD1AdminMutationStore(db).taxonomies.deleteCategory(id);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.deleteCategory(id, actor),
		{
			action: "category.delete",
			resourceId: String(id),
			message: `Deleted category ${id}.`,
			onlyIfOk: false,
		},
	);
}

export async function createRuntimeTag(
	input: { name: string; slug?: string; description?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).taxonomies.createTag(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.createTag(input, actor),
		{
			action: "tag.create",
			resourceId: input.slug ?? input.name,
			message: `Created tag ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function updateRuntimeTag(
	input: { id: number; name: string; slug?: string; description?: string },
	actor: Actor,
	locals?: App.Locals | null,
) {
	return runTaxonomyMutation(
		locals,
		actor,
		(db) => createD1AdminMutationStore(db).taxonomies.updateTag(input),
		/* v8 ignore next 1 */
		(localStore) => localStore.updateTag(input, actor),
		{
			action: "tag.update",
			resourceId: String(input.id),
			message: `Updated tag ${input.name.trim()}.`,
			onlyIfOk: true,
		},
	);
}

export async function deleteRuntimeTag(id: number, actor: Actor, locals?: App.Locals | null) {
	return runTaxonomyMutation(
		locals,
		actor,
		async (db) => {
			await createD1AdminMutationStore(db).taxonomies.deleteTag(id);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.deleteTag(id, actor),
		{
			action: "tag.delete",
			resourceId: String(id),
			message: `Deleted tag ${id}.`,
			onlyIfOk: false,
		},
	);
}
