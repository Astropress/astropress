import { defaultSiteSettings } from "./site-settings.js";

export function createAstropressSettingsRepository(input) {
  return {
    getSettings: (...args) => input.getSettings(...args),
    saveSettings(partial, actor) {
      const current = input.getSettings() ?? defaultSiteSettings;
      const updated = {
        siteTitle: partial.siteTitle ?? current.siteTitle,
        siteTagline: partial.siteTagline ?? current.siteTagline,
        donationUrl: partial.donationUrl ?? current.donationUrl,
        newsletterEnabled: partial.newsletterEnabled ?? current.newsletterEnabled,
        commentsDefaultPolicy: partial.commentsDefaultPolicy ?? current.commentsDefaultPolicy,
        adminSlug: partial.adminSlug ?? current.adminSlug,
      };

      input.persistSettings(updated, actor);
      input.recordSettingsAudit(actor);

      return { ok: true, settings: updated };
    },
  };
}
