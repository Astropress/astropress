import { defaultSiteSettings, type SiteSettings } from "./site-settings";
import type { Actor, SettingsRepository } from "./persistence-types";

export interface AstropressSettingsRepositoryInput {
  getSettings: SettingsRepository["getSettings"];
  persistSettings(settings: SiteSettings, actor: Actor): void;
  recordSettingsAudit(actor: Actor): void;
}

export function createAstropressSettingsRepository(
  input: AstropressSettingsRepositoryInput,
): SettingsRepository {
  return {
    getSettings: (...args) => input.getSettings(...args),
    saveSettings(partial, actor) {
      const current = input.getSettings() ?? defaultSiteSettings;
      const updated: SiteSettings = {
        siteTitle: partial.siteTitle ?? current.siteTitle,
        siteTagline: partial.siteTagline ?? current.siteTagline,
        donationUrl: partial.donationUrl ?? current.donationUrl,
        newsletterEnabled: partial.newsletterEnabled ?? current.newsletterEnabled,
        commentsDefaultPolicy: partial.commentsDefaultPolicy ?? current.commentsDefaultPolicy,
        adminSlug: partial.adminSlug ?? current.adminSlug,
      };

      input.persistSettings(updated, actor);
      input.recordSettingsAudit(actor);

      return { ok: true as const, settings: updated };
    },
  };
}
