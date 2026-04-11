// ─── WordPress Import Types ───────────────────────────────────────────────────
// Extracted from platform-contracts.ts to keep that file under the 400-line limit.

export interface AstropressWordPressImportEntityCount {
  posts: number;
  pages: number;
  attachments: number;
  redirects: number;
  comments: number;
  users: number;
  categories: number;
  tags: number;
  skipped: number;
}

export interface AstropressWordPressImportInventory {
  exportFile?: string;
  sourceUrl?: string;
  detectedRecords: number;
  detectedMedia: number;
  detectedComments: number;
  detectedUsers: number;
  detectedShortcodes: number;
  detectedBuilderMarkers: number;
  entityCounts: AstropressWordPressImportEntityCount;
  unsupportedPatterns: string[];
  remediationCandidates: string[];
  warnings: string[];
}

export interface AstropressWordPressImportPlan {
  sourceUrl?: string;
  exportFile?: string;
  artifactDir?: string;
  includeComments: boolean;
  includeUsers: boolean;
  includeMedia: boolean;
  downloadMedia: boolean;
  applyLocal: boolean;
  permalinkStrategy: "preserve-wordpress-links";
  resumeSupported: boolean;
  entityCounts: AstropressWordPressImportEntityCount;
  reviewRequired: boolean;
  manualTasks: string[];
}

export interface AstropressWordPressImportArtifacts {
  artifactDir?: string;
  inventoryFile?: string;
  planFile?: string;
  contentFile?: string;
  mediaFile?: string;
  commentFile?: string;
  userFile?: string;
  redirectFile?: string;
  taxonomyFile?: string;
  remediationFile?: string;
  downloadStateFile?: string;
  localApplyReportFile?: string;
  reportFile?: string;
}

export interface AstropressWordPressImportLocalApplyReport {
  runtime: "sqlite-local";
  workspaceRoot: string;
  adminDbPath: string;
  appliedRecords: number;
  appliedMedia: number;
  appliedComments: number;
  appliedUsers: number;
  appliedRedirects: number;
}

export interface AstropressWordPressImportReport {
  status: "completed" | "completed_with_warnings";
  importedRecords: number;
  importedMedia: number;
  importedComments: number;
  importedUsers: number;
  importedRedirects: number;
  downloadedMedia: number;
  failedMedia: Array<{ id: string; sourceUrl?: string; reason: string }>;
  reviewRequired: boolean;
  manualTasks: string[];
  plan: AstropressWordPressImportPlan;
  inventory: AstropressWordPressImportInventory;
  artifacts?: AstropressWordPressImportArtifacts;
  localApply?: AstropressWordPressImportLocalApplyReport;
  warnings: string[];
}

export interface ImportSource {
  inspectWordPress?(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
  }): Promise<AstropressWordPressImportInventory>;
  planWordPressImport?(input: {
    inventory: AstropressWordPressImportInventory;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    artifactDir?: string;
    applyLocal?: boolean;
  }): Promise<AstropressWordPressImportPlan>;
  importWordPress(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    artifactDir?: string;
    applyLocal?: boolean;
    workspaceRoot?: string;
    adminDbPath?: string;
    resumeFrom?: string;
    plan?: AstropressWordPressImportPlan;
  }): Promise<AstropressWordPressImportReport>;
  resumeWordPressImport?(input: {
    sourceUrl?: string;
    exportFile?: string;
    artifactDir: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    applyLocal?: boolean;
    workspaceRoot?: string;
    adminDbPath?: string;
  }): Promise<AstropressWordPressImportReport>;
}
