import { describe, expect, it, vi } from "vitest";
import { createAstropressSettingsRepository } from "../src/settings-repository-factory";

describe("settings repository factory", () => {
	it("merges and persists site settings through package-owned repository assembly", () => {
		const persistSettings = vi.fn();
		const recordSettingsAudit = vi.fn();
		const repository = createAstropressSettingsRepository({
			getSettings: vi.fn(() => ({
				siteTitle: "Acme",
				siteTagline: "Food",
				donationUrl: "/donate",
				newsletterEnabled: true,
				commentsDefaultPolicy: "open-moderated",
				adminSlug: "ap-admin",
			})),
			persistSettings,
			recordSettingsAudit,
		});

		const result = repository.saveSettings(
			{
				siteTitle: "Acme Corp",
				newsletterEnabled: false,
			},
			{ email: "admin@example.com", role: "admin", name: "Admin" },
		);

		expect(result).toEqual({
			ok: true,
			settings: {
				siteTitle: "Acme Corp",
				siteTagline: "Food",
				donationUrl: "/donate",
				newsletterEnabled: false,
				commentsDefaultPolicy: "open-moderated",
				adminSlug: "ap-admin",
			},
		});
		expect(persistSettings).toHaveBeenCalledTimes(1);
		expect(recordSettingsAudit).toHaveBeenCalledTimes(1);
	});
});
