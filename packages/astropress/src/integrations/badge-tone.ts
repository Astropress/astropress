/**
 * Pure helpers for `IntegrationStatusBadge.astro`. The component is
 * SSR-only; pulling the discrete decisions out into TypeScript lets
 * the mapping be unit-tested (and mutation-tested) without bringing
 * an Astro container into the test runner.
 *
 * The four-state space mirrors `connected_integrations.status` from
 * Phase 2 plus the synthetic `not-connected` state used when a domain
 * has no row at all.
 */

export type IntegrationStatusBadgeKind =
	| "connected"
	| "error"
	| "paused"
	| "not-connected";

export type IntegrationStatusBadgeTone = "ok" | "err" | "warn" | "muted";

export interface IntegrationStatusBadgeLabels {
	readonly connected: string;
	readonly error: string;
	readonly paused: string;
	readonly notConnected: string;
}

export function integrationStatusBadgeTone(
	status: IntegrationStatusBadgeKind,
): IntegrationStatusBadgeTone {
	if (status === "connected") return "ok";
	if (status === "error") return "err";
	if (status === "paused") return "warn";
	return "muted";
}

export function integrationStatusBadgeText(
	status: IntegrationStatusBadgeKind,
	labels: IntegrationStatusBadgeLabels,
): string {
	if (status === "connected") return labels.connected;
	if (status === "error") return labels.error;
	if (status === "paused") return labels.paused;
	return labels.notConnected;
}
