export type SiteEntry = {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  adminUrl?: string;
  deployHookUrl?: string;
  description?: string;
};

export type NexusConfig = {
  sites: SiteEntry[];
  dashboardTitle?: string;
};

export type SiteStatus = "ok" | "degraded" | "unknown";

export type SiteHealth = {
  id: string;
  name: string;
  baseUrl: string;
  status: SiteStatus;
  error?: string;
  latencyMs?: number;
};

export type FanOutResult<T> = {
  siteId: string;
  status: "ok" | "degraded";
  data?: T;
  error?: string;
};

export type ContentItem = {
  siteId: string;
  id: string;
  slug: string;
  title?: string;
  kind: string;
  status: string;
  [key: string]: unknown;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobEntry = {
  id: string;
  siteId: string;
  kind: "import:wordpress";
  status: JobStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
};

export type AggregateMetrics = {
  siteCount: number;
  reachableSites: number;
  degradedSites: number;
  totalPosts: number;
  totalPages: number;
  totalMedia: number;
  sites: Array<{
    id: string;
    status: SiteStatus;
    posts?: number;
    pages?: number;
    media?: number;
  }>;
};
