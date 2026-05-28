import {
	assertSafeImportExportFile,
	getCmsConfig,
	ImportPathError,
} from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import { apiErrors, jsonOk, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import { createAstropressWordPressImportSource } from "@astropress-diy/astropress/import/wordpress.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) {
		return apiErrors.notFound("REST API is not enabled.");
	}

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens) {
		return apiErrors.notFound("API token store unavailable.");
	}

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: 5,
		},
		["import:write"],
		async () => {
			let body: Record<string, unknown>;
			try {
				body = (await context.request.json()) as Record<string, unknown>;
			} catch {
				return apiErrors.validationError("Request body must be valid JSON.");
			}

			const rawExportFile = typeof body.exportFile === "string" ? body.exportFile.trim() : "";
			if (!rawExportFile) {
				return apiErrors.validationError("exportFile is required.");
			}
			// #118: this exportFile is untrusted operator input feeding a file read.
			// Confine it to the workspace root and reject absolute paths / `..`
			// traversal before it reaches the importer.
			const workspaceRoot = process.cwd();
			let exportFile: string;
			try {
				exportFile = assertSafeImportExportFile(rawExportFile, workspaceRoot);
			} catch (err) {
				if (err instanceof ImportPathError) {
					return apiErrors.validationError(err.message);
				}
				throw err;
			}

			const source = createAstropressWordPressImportSource();
			const report = await source.importWordPress({
				exportFile,
				applyLocal: true,
				workspaceRoot,
			});

			return jsonOk(report as unknown as Record<string, unknown>);
		},
	);
};
