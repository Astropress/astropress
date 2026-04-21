import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
	AstropressWordPressImportArtifacts,
	AstropressWordPressImportInventory,
	AstropressWordPressImportPlan,
	AstropressWordPressImportReport,
	ImportSource,
} from "../platform-contracts";
import {
	applyImportToLocalRuntime,
	fileSizeOrNull,
} from "./wordpress-apply.js";
import {
	detectUnsupportedPatterns,
	parseWordPressExport,
} from "./wordpress-xml.js";
import type { ParsedBundle } from "./wordpress-xml.js";

export interface AstropressWordPressImportSourceOptions {
	sourceUrl?: string;
}

type DownloadState = {
	completed: string[];
	failed: Array<{ id: string; sourceUrl?: string; reason: string }>;
};

async function readDownloadState(
	downloadStateFile: string,
): Promise<DownloadState> {
	try {
		return JSON.parse(
			await readFile(downloadStateFile, "utf8"),
		) as DownloadState;
	} catch {
		return { completed: [], failed: [] };
	}
}

async function writeJsonArtifact(targetPath: string, value: unknown) {
	await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function downloadMediaAssets(
	mediaAssets: ParsedBundle["mediaAssets"],
	artifactDir: string,
	resumeFrom?: string,
) {
	const downloadsDir = path.join(artifactDir, "downloads");
	const downloadStateFile = path.join(artifactDir, "download-state.json");
	await mkdir(downloadsDir, { recursive: true });

	const state = await readDownloadState(resumeFrom || downloadStateFile);
	const completed = new Set(state.completed);
	const failed: DownloadState["failed"] = [...state.failed];
	let downloadedMedia = 0;

	for (const asset of mediaAssets) {
		const assetTarget = path.join(downloadsDir, path.basename(asset.filename));
		if (completed.has(asset.id) && (await fileSizeOrNull(assetTarget)) !== null)
			continue;
		try {
			const response = await fetch(asset.sourceUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			await writeFile(
				assetTarget,
				// audit-ok: assetTarget uses path.basename() to strip traversal from the HTTP-supplied filename; bytes intentionally written from the import response
				new Uint8Array(await response.arrayBuffer()), // codeql[js/http-to-file-access]
			);
			completed.add(asset.id);
			downloadedMedia += 1;
		} catch (error) {
			failed.push({
				id: asset.id,
				sourceUrl: asset.sourceUrl,
				reason:
					error instanceof Error
						? error.message
						: "Unknown media download error",
			});
		}
	}

	const normalizedState: DownloadState = {
		completed: [...completed].sort(),
		failed: failed.filter(
			(e, i, all) =>
				all.findIndex((c) => c.id === e.id && c.reason === e.reason) === i,
		),
	};
	await writeJsonArtifact(downloadStateFile, normalizedState);
	return {
		downloadStateFile,
		downloadedMedia,
		failedMedia: normalizedState.failed,
	};
}

async function parseImportInput(
	input: Parameters<ImportSource["importWordPress"]>[0],
) {
	if (!input.exportFile)
		throw new Error("WordPress import requires an `exportFile` path.");
	const source = await readFile(input.exportFile, "utf8");
	const bundle = parseWordPressExport(source);
	const inventory = buildInventory(input, bundle);
	return { source, bundle, inventory };
}

function buildInventory(
	input: { exportFile?: string; sourceUrl?: string },
	bundle: ParsedBundle,
): AstropressWordPressImportInventory {
	const unsupported = detectUnsupportedPatterns(
		bundle.contentRecords
			.map((r) => `${r.body}\n${r.excerpt ?? ""}`)
			.join("\n"),
	);
	return {
		exportFile: input.exportFile,
		sourceUrl: input.sourceUrl,
		detectedRecords: bundle.contentRecords.length + bundle.mediaAssets.length,
		detectedMedia: bundle.mediaAssets.length,
		detectedComments: bundle.comments.length,
		detectedUsers: bundle.authors.length,
		detectedShortcodes: unsupported.shortcodeMatches,
		detectedBuilderMarkers: unsupported.builderMatches,
		entityCounts: bundle.entityCounts,
		unsupportedPatterns: bundle.unsupportedPatterns,
		remediationCandidates: bundle.remediationCandidates,
		warnings: bundle.warnings,
	};
}

function buildImportPlan(
	inventory: AstropressWordPressImportInventory,
	overrides: Pick<
		AstropressWordPressImportPlan,
		| "includeComments"
		| "includeUsers"
		| "includeMedia"
		| "downloadMedia"
		| "applyLocal"
	> & {
		artifactDir?: string;
	} = {
		includeComments: true,
		includeUsers: true,
		includeMedia: true,
		downloadMedia: false,
		applyLocal: false,
	},
): AstropressWordPressImportPlan {
	const includeComments =
		overrides.includeComments ?? inventory.detectedComments > 0;
	const includeUsers = overrides.includeUsers ?? inventory.detectedUsers > 0;
	const includeMedia = overrides.includeMedia ?? inventory.detectedMedia > 0;
	const downloadMedia = includeMedia && (overrides.downloadMedia ?? false);
	const applyLocal = overrides.applyLocal ?? false;
	const manualTasks = [...inventory.warnings];

	if (inventory.remediationCandidates.length > 0) {
		manualTasks.push(
			"Review remediation-candidates.json for shortcode or page-builder cleanup before publishing staged content.",
		);
	}
	if (downloadMedia && !overrides.artifactDir) {
		manualTasks.push(
			"Media download was requested without an artifact directory; downloads will be skipped.",
		);
	}

	return {
		sourceUrl: inventory.sourceUrl,
		exportFile: inventory.exportFile,
		artifactDir: overrides.artifactDir,
		includeComments,
		includeUsers,
		includeMedia,
		downloadMedia: downloadMedia && Boolean(overrides.artifactDir),
		applyLocal,
		permalinkStrategy: "preserve-wordpress-links",
		resumeSupported: true,
		entityCounts: inventory.entityCounts,
		reviewRequired: inventory.unsupportedPatterns.length > 0,
		manualTasks: [...new Set(manualTasks)],
	};
}

async function stageArtifacts(
	artifactDir: string,
	inventory: AstropressWordPressImportInventory,
	plan: AstropressWordPressImportPlan,
	bundle: ParsedBundle,
	resumeFrom?: string,
): Promise<{
	artifacts: AstropressWordPressImportArtifacts;
	downloadedMedia: number;
	failedMedia: AstropressWordPressImportReport["failedMedia"];
}> {
	await mkdir(artifactDir, { recursive: true });

	const artifacts: AstropressWordPressImportArtifacts = {
		artifactDir,
		inventoryFile: path.join(artifactDir, "wordpress.inventory.json"),
		planFile: path.join(artifactDir, "wordpress.plan.json"),
		contentFile: path.join(artifactDir, "content-records.json"),
		mediaFile: path.join(artifactDir, "media-manifest.json"),
		commentFile: path.join(artifactDir, "comment-records.json"),
		userFile: path.join(artifactDir, "user-records.json"),
		redirectFile: path.join(artifactDir, "redirect-records.json"),
		taxonomyFile: path.join(artifactDir, "taxonomy-records.json"),
		remediationFile: path.join(artifactDir, "remediation-candidates.json"),
		downloadStateFile: path.join(artifactDir, "download-state.json"),
	};

	await writeJsonArtifact(artifacts.inventoryFile, inventory);
	await writeJsonArtifact(artifacts.planFile, plan);
	await writeJsonArtifact(artifacts.contentFile, bundle.contentRecords);
	await writeJsonArtifact(artifacts.mediaFile, bundle.mediaAssets);
	await writeJsonArtifact(artifacts.commentFile, bundle.comments);
	await writeJsonArtifact(artifacts.userFile, bundle.authors);
	await writeJsonArtifact(artifacts.redirectFile, bundle.redirects);
	await writeJsonArtifact(artifacts.taxonomyFile, bundle.terms);
	await writeJsonArtifact(
		artifacts.remediationFile,
		bundle.remediationCandidates,
	);

	if (!plan.downloadMedia) {
		await writeJsonArtifact(artifacts.downloadStateFile, {
			completed: [],
			failed: [],
		} satisfies DownloadState);
		return { artifacts, downloadedMedia: 0, failedMedia: [] };
	}

	const downloadOutcome = await downloadMediaAssets(
		bundle.mediaAssets,
		artifactDir,
		resumeFrom,
	);
	artifacts.downloadStateFile = downloadOutcome.downloadStateFile;
	return {
		artifacts,
		downloadedMedia: downloadOutcome.downloadedMedia,
		failedMedia: downloadOutcome.failedMedia,
	};
}

function resolveImportOverrides(input: {
	includeComments?: boolean;
	includeUsers?: boolean;
	includeMedia?: boolean;
	downloadMedia?: boolean;
	artifactDir?: string;
	applyLocal?: boolean;
}) {
	return {
		includeComments: input.includeComments ?? true,
		includeUsers: input.includeUsers ?? true,
		includeMedia: input.includeMedia ?? true,
		downloadMedia: input.downloadMedia ?? false,
		artifactDir: input.artifactDir,
		applyLocal: input.applyLocal ?? false,
	};
}

function resolveImportStatus(
	plan: AstropressWordPressImportPlan,
	failedMedia: AstropressWordPressImportReport["failedMedia"],
): AstropressWordPressImportReport["status"] {
	return plan.reviewRequired || failedMedia.length > 0
		? "completed_with_warnings"
		: "completed";
}

export function createAstropressWordPressImportSource(
	options: AstropressWordPressImportSourceOptions = {},
): ImportSource {
	return {
		async inspectWordPress(input) {
			const { inventory } = await parseImportInput({
				...input,
				sourceUrl: input.sourceUrl ?? options.sourceUrl,
			});
			return inventory;
		},
		async planWordPressImport(input) {
			return buildImportPlan(input.inventory, resolveImportOverrides(input));
		},
		async importWordPress(input) {
			const { bundle, inventory } = await parseImportInput({
				...input,
				sourceUrl: input.sourceUrl ?? options.sourceUrl,
			});
			const plan =
				input.plan ?? buildImportPlan(inventory, resolveImportOverrides(input));

			const artifactsOutcome = plan.artifactDir
				? await stageArtifacts(
						plan.artifactDir,
						inventory,
						plan,
						bundle,
						input.resumeFrom,
					)
				: { artifacts: undefined, downloadedMedia: 0, failedMedia: [] };

			const localApply = plan.applyLocal
				? await applyImportToLocalRuntime({
						bundle,
						artifactDir: plan.artifactDir,
						workspaceRoot: input.workspaceRoot ?? process.cwd(),
						adminDbPath: input.adminDbPath,
						plan,
					})
				: undefined;

			if (plan.applyLocal && plan.artifactDir) {
				const localApplyReportFile = path.join(
					plan.artifactDir,
					"wordpress.local-apply.json",
				);
				await writeJsonArtifact(localApplyReportFile, localApply);
				if (artifactsOutcome.artifacts)
					artifactsOutcome.artifacts.localApplyReportFile =
						localApplyReportFile;
			}

			if (plan.artifactDir && artifactsOutcome.artifacts) {
				const reportFile = path.join(plan.artifactDir, "import-report.json");
				await writeJsonArtifact(reportFile, {
					generatedAt: new Date().toISOString(),
					status: resolveImportStatus(plan, artifactsOutcome.failedMedia),
					counts: bundle.entityCounts,
					mediaErrors: artifactsOutcome.failedMedia.map((f) => ({
						id: f.id,
						sourceUrl: f.sourceUrl,
						reason: f.reason,
					})),
					manualReviewFlags: bundle.remediationCandidates,
					warnings: plan.manualTasks,
				});
				artifactsOutcome.artifacts.reportFile = reportFile;
			}

			return {
				status: resolveImportStatus(plan, artifactsOutcome.failedMedia),
				importedRecords: bundle.contentRecords.length,
				importedMedia: plan.includeMedia ? bundle.mediaAssets.length : 0,
				importedComments: plan.includeComments ? bundle.comments.length : 0,
				importedUsers: plan.includeUsers ? bundle.authors.length : 0,
				importedRedirects: bundle.redirects.length,
				downloadedMedia: artifactsOutcome.downloadedMedia,
				failedMedia: artifactsOutcome.failedMedia,
				reviewRequired: plan.reviewRequired,
				manualTasks: plan.manualTasks,
				plan,
				inventory,
				artifacts: artifactsOutcome.artifacts,
				localApply,
				warnings: [
					...new Set([
						...inventory.warnings,
						...plan.manualTasks,
						...(localApply
							? [
									`Applied WordPress import into local SQLite runtime at ${localApply.adminDbPath}.`,
								]
							: []),
						...artifactsOutcome.failedMedia.map(
							(e) => `Media download failed for ${e.id}: ${e.reason}`,
						),
					]),
				],
			} satisfies AstropressWordPressImportReport;
		},
		async resumeWordPressImport(input) {
			return this.importWordPress({
				...input,
				sourceUrl: input.sourceUrl ?? options.sourceUrl,
				artifactDir: input.artifactDir,
				resumeFrom: path.join(input.artifactDir, "download-state.json"),
			});
		},
	};
}
