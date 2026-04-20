import type {
	Actor,
	RedirectRepository,
	RedirectRule,
} from "./persistence-types";

export interface AstropressRedirectRepositoryInput {
	getRedirectRules: RedirectRepository["getRedirectRules"];
	normalizePath(path: string): string;
	getExistingRedirect(
		sourcePath: string,
	): { deletedAt: string | null } | null | undefined;
	upsertRedirect(input: {
		sourcePath: string;
		targetPath: string;
		statusCode: 301 | 302;
		actor: Actor;
	}): void;
	markRedirectDeleted(sourcePath: string): boolean;
	recordRedirectAudit(input: {
		actor: Actor;
		action: "redirect.create" | "redirect.delete";
		summary: string;
		targetId: string;
	}): void;
}

export function createAstropressRedirectRepository(
	input: AstropressRedirectRepositoryInput,
): RedirectRepository {
	return {
		getRedirectRules: (...args) => input.getRedirectRules(...args),
		createRedirectRule(rawInput, actor) {
			const sourcePath = input.normalizePath(rawInput.sourcePath);
			const targetPath = input.normalizePath(rawInput.targetPath);
			const statusCode: 301 | 302 = rawInput.statusCode === 302 ? 302 : 301;

			if (!sourcePath || !targetPath) {
				return {
					ok: false as const,
					error: "Both legacy and target paths are required.",
				};
			}

			if (sourcePath === targetPath) {
				return {
					ok: false as const,
					error: "Legacy and target paths must be different.",
				};
			}

			const existing = input.getExistingRedirect(sourcePath);
			if (existing && existing.deletedAt === null) {
				return {
					ok: false as const,
					error: "That legacy path already has a reviewed redirect rule.",
				};
			}

			input.upsertRedirect({
				sourcePath,
				targetPath,
				statusCode,
				actor,
			});

			input.recordRedirectAudit({
				actor,
				action: "redirect.create",
				summary: `Created redirect ${sourcePath} -> ${targetPath} (${statusCode}).`,
				targetId: sourcePath,
			});

			return {
				ok: true as const,
				rule: { sourcePath, targetPath, statusCode } satisfies RedirectRule,
			};
		},
		deleteRedirectRule(sourcePath, actor) {
			const normalizedSourcePath = input.normalizePath(sourcePath);
			const deleted = input.markRedirectDeleted(normalizedSourcePath);
			if (!deleted) {
				return { ok: false as const };
			}

			input.recordRedirectAudit({
				actor,
				action: "redirect.delete",
				summary: `Deleted redirect ${normalizedSourcePath}.`,
				targetId: normalizedSourcePath,
			});

			return { ok: true as const };
		},
	};
}
