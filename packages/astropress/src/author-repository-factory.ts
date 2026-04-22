import type { Actor, AuthorRepository } from "./persistence-types";

export interface AstropressAuthorRepositoryInput {
	listAuthors: AuthorRepository["listAuthors"];
	slugifyTerm(value: string): string;
	createAuthor(input: { slug: string; name: string; bio: string }): boolean;
	updateAuthor(input: {
		id: number;
		slug: string;
		name: string;
		bio: string;
	}): boolean;
	deleteAuthor(id: number): boolean;
	recordAuthorAudit(input: {
		actor: Actor;
		action: "author.create" | "author.update" | "author.delete";
		summary: string;
		targetId: string;
	}): void;
}

export function createAstropressAuthorRepository(
	input: AstropressAuthorRepositoryInput,
): AuthorRepository {
	return {
		listAuthors: (...args) => input.listAuthors(...args),
		createAuthor(rawInput, actor) {
			const name = rawInput.name.trim();
			const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
			if (!name || !slug) {
				return {
					ok: false as const,
					error: "Author name and slug are required.",
				};
			}

			const created = input.createAuthor({
				slug,
				name,
				bio: rawInput.bio?.trim() ?? "",
			});
			if (!created) {
				return {
					ok: false as const,
					error: "That author name or slug is already in use.",
				};
			}

			input.recordAuthorAudit({
				actor,
				action: "author.create",
				summary: `Created author ${name}.`,
				targetId: slug,
			});
			return { ok: true as const };
		},
		updateAuthor(rawInput, actor) {
			const name = rawInput.name.trim();
			const slug = input.slugifyTerm(rawInput.slug?.trim() || name);
			if (!rawInput.id || !name || !slug) {
				return {
					ok: false as const,
					error: "Author id, name, and slug are required.",
				};
			}

			const updated = input.updateAuthor({
				id: rawInput.id,
				slug,
				name,
				bio: rawInput.bio?.trim() ?? "",
			});
			if (!updated) {
				return {
					ok: false as const,
					error: "That author could not be updated.",
				};
			}

			input.recordAuthorAudit({
				actor,
				action: "author.update",
				summary: `Updated author ${name}.`,
				targetId: String(rawInput.id),
			});
			return { ok: true as const };
		},
		deleteAuthor(id, actor) {
			const deleted = input.deleteAuthor(id);
			if (!deleted) {
				return {
					ok: false as const,
					error: "That author could not be deleted.",
				};
			}

			input.recordAuthorAudit({
				actor,
				action: "author.delete",
				summary: `Deleted author ${id}.`,
				targetId: String(id),
			});
			return { ok: true as const };
		},
	};
}
