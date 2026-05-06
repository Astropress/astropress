import { afterEach, describe, expect, it } from "vitest";

import { buildAstropressAdminDocumentTitle } from "../src/admin-branding";
import {
	adminLabels,
	getAdminLabel,
	resolveAstropressAdminUiConfig,
} from "../src/admin-ui";
import { getCmsConfig, type peekCmsConfig, registerCms } from "../src/config";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function restoreConfig(config: ReturnType<typeof peekCmsConfig>) {
	(globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[
		CMS_CONFIG_KEY
	] = config ?? null;
}

afterEach(() => {
	restoreConfig(null);
});

describe("getCmsConfig — uninitialized state", () => {
	it("throws when getCmsConfig is called before registerCms", () => {
		restoreConfig(null);
		expect(() => getCmsConfig()).toThrow("Astropress not initialized");
	});
});

describe("admin ui", () => {
	it("exposes generic defaults when no admin customization is registered", () => {
		restoreConfig(null);

		const adminUi = resolveAstropressAdminUiConfig();

		expect(adminUi.branding.productName).toBe("Astropress Admin");
		expect(adminUi.branding.logoSrc).toBeNull();
		expect(adminUi.branding.stylesheetHref).toBeNull();
		expect(adminUi.labels.sidebarTitle).toBe("Workspace");
		expect(adminUi.navigation.routePages).toBe("Route Table");
		expect(buildAstropressAdminDocumentTitle("Dashboard")).toBe(
			"Dashboard | Astropress Admin",
		);
	});

	it("merges host branding, labels, navigation, and assets from registerCms()", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: ["home"],
			seedPages: [],
			archives: [],
			translationStatus: [],
			admin: {
				branding: {
					appName: "Client Console",
					productName: "Client Console Admin",
					shellName: "Client Workspace",
					logoSrc: "/brand/admin-mark.svg",
					faviconHref: "/brand/favicon.ico",
					stylesheetHref: "/brand/admin.css",
				},
				labels: {
					sidebarTitle: "Operations",
					signOut: "Log out",
					loginHeading: "Client sign in",
					loginSubmit: "Continue",
				},
				navigation: {
					routePages: "Page Routes",
					media: "Asset Library",
				},
			},
		});

		const adminUi = resolveAstropressAdminUiConfig();

		expect(adminUi.branding.appName).toBe("Client Console");
		expect(adminUi.branding.productName).toBe("Client Console Admin");
		expect(adminUi.branding.shellName).toBe("Client Workspace");
		expect(adminUi.branding.logoSrc).toBe("/brand/admin-mark.svg");
		expect(adminUi.branding.faviconHref).toBe("/brand/favicon.ico");
		expect(adminUi.branding.stylesheetHref).toBe("/brand/admin.css");
		expect(adminUi.labels.sidebarTitle).toBe("Operations");
		expect(adminUi.labels.signOut).toBe("Log out");
		expect(adminUi.labels.loginHeading).toBe("Client sign in");
		expect(adminUi.labels.loginSubmit).toBe("Continue");
		expect(adminUi.navigation.routePages).toBe("Page Routes");
		expect(adminUi.navigation.media).toBe("Asset Library");
		expect(buildAstropressAdminDocumentTitle("Dashboard")).toBe(
			"Dashboard | Client Console Admin",
		);
	});

	it("exposes locale-aware admin labels in Spanish when locale is es", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "es")).toBe("Guardar");
		expect(getAdminLabel("publishButton", "es")).toBe("Publicar");
		expect(getAdminLabel("signOut", "es")).toBe("Cerrar sesión");
		expect(getAdminLabel("loginHeading", "es")).toBe(
			"Acceder al panel de administración",
		);
		expect(getAdminLabel("sidebarTitle", "es")).toBe("Espacio de trabajo");
	});

	it("exposes locale-aware admin labels in French when locale is fr", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "fr")).toBe("Enregistrer");
		expect(getAdminLabel("deleteButton", "fr")).toBe("Supprimer");
		expect(getAdminLabel("cancelButton", "fr")).toBe("Annuler");
	});

	it("exposes locale-aware admin labels in Japanese when locale is ja", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "ja")).toBe("保存");
		expect(getAdminLabel("publishButton", "ja")).toBe("公開");
		expect(getAdminLabel("signOut", "ja")).toBe("サインアウト");
	});

	it("exposes locale-aware admin labels in Arabic when locale is ar", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "ar")).toBe("حفظ");
		expect(getAdminLabel("publishButton", "ar")).toBe("نشر");
		expect(getAdminLabel("deleteButton", "ar")).toBe("حذف");
		expect(getAdminLabel("cancelButton", "ar")).toBe("إلغاء");
		expect(getAdminLabel("signOut", "ar")).toBe("تسجيل الخروج");
		expect(getAdminLabel("loginHeading", "ar")).toBe(
			"تسجيل الدخول إلى لوحة الإدارة",
		);
		expect(getAdminLabel("loginSubmit", "ar")).toBe("تسجيل الدخول");
		expect(getAdminLabel("sidebarTitle", "ar")).toBe("مساحة العمل");
		expect(getAdminLabel("navDashboard", "ar")).toBe("لوحة التحكم");
		expect(getAdminLabel("navMedia", "ar")).toBe("الوسائط");
		expect(getAdminLabel("navUsers", "ar")).toBe("المستخدمون");
		expect(getAdminLabel("navSettings", "ar")).toBe("الإعدادات");
		expect(getAdminLabel("changeLanguage", "ar")).toBe("تغيير اللغة");
		expect(getAdminLabel("loadingLabel", "ar")).toBe("جارٍ التحميل…");
		expect(getAdminLabel("errorLabel", "ar")).toBe("فشل الإجراء");
	});

	it("BCP-47 ar-SA resolves to ar", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "ar-SA")).toBe("حفظ");
	});

	it("translates navGroupComingSoon per locale (used by integration-honesty sidebar split)", () => {
		restoreConfig(null);
		expect(getAdminLabel("navGroupComingSoon", "en")).toBe("Coming soon");
		expect(getAdminLabel("navGroupComingSoon", "es")).toBe("Próximamente");
		expect(getAdminLabel("navGroupComingSoon", "fr")).toBe(
			"Bientôt disponible",
		);
		expect(getAdminLabel("navGroupComingSoon", "ar")).toBe("قريبًا");
		expect(getAdminLabel("navGroupComingSoon", "ja")).toBe("近日公開");
	});

	it("translates RequiresIntegration coming-soon strings per locale", () => {
		restoreConfig(null);
		expect(getAdminLabel("stubComingSoonHeading", "en")).toBe("Coming soon");
		expect(getAdminLabel("stubComingSoonBody", "en")).toMatch(/roadmap/i);
		expect(getAdminLabel("stubComingSoonLink", "en")).toMatch(/GitHub/);
		expect(getAdminLabel("stubComingSoonHeading", "es")).toBe("Próximamente");
		expect(getAdminLabel("stubComingSoonHeading", "ja")).toBe("近日公開");
		expect(getAdminLabel("stubComingSoonHeading", "ar")).toBe("قريبًا");
		expect(getAdminLabel("stubComingSoonBody", "fr")).not.toBe(
			adminLabels.en.stubComingSoonBody,
		);
	});

	it("Arabic translations are non-empty strings for every key", () => {
		const arDict = adminLabels.ar;
		const keys = Object.keys(adminLabels.en) as Array<
			keyof typeof adminLabels.en
		>;
		for (const k of keys) {
			expect(typeof arDict[k]).toBe("string");
			expect(arDict[k].length).toBeGreaterThan(0);
		}
	});

	it("falls back to English when locale is unknown", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "zz")).toBe(adminLabels.en.saveButton);
		expect(getAdminLabel("publishButton", "xx")).toBe(
			adminLabels.en.publishButton,
		);
	});

	it("falls back to English when locale is undefined (no cms config)", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton")).toBe("Save");
		expect(getAdminLabel("sidebarTitle")).toBe("Workspace");
	});

	it("uses site configured locale from registerCms when no explicit locale is passed", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [],
			locales: ["de"],
		});
		expect(getAdminLabel("saveButton")).toBe("Speichern");
		expect(getAdminLabel("signOut")).toBe("Abmelden");
	});

	it("BCP-47 tags with region (e.g. es-MX) resolve to the base locale (es)", () => {
		restoreConfig(null);
		expect(getAdminLabel("saveButton", "es-MX")).toBe("Guardar");
		expect(getAdminLabel("saveButton", "pt-BR")).toBe("Salvar");
	});

	it("resolveAstropressAdminUiConfig(locale) applies translations through applyTranslations", () => {
		restoreConfig(null);
		const adminUi = resolveAstropressAdminUiConfig("es");
		expect(adminUi.labels.signOut).toBe("Cerrar sesión");
		expect(adminUi.labels.sidebarTitle).toBe("Espacio de trabajo");
		expect(adminUi.navigation.dashboard).toBeTruthy();
		expect(adminUi.branding.productName).toBe("Astropress Admin");
	});

	it("resolveAstropressAdminUiConfig(locale) preserves host overrides and translates remaining keys", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [],
			admin: {
				labels: { signOut: "Salir" },
				navigation: { routePages: "Rutas" },
			},
		});
		const adminUi = resolveAstropressAdminUiConfig("es");
		expect(adminUi.labels.sidebarTitle).toBe("Espacio de trabajo");
		expect(adminUi.navigation.dashboard).toBeTruthy();
	});

	it("falls back to null for stylesheetHref when override is empty string", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [],
			admin: { branding: { stylesheetHref: "" } },
		});
		const adminUi = resolveAstropressAdminUiConfig();
		expect(adminUi.branding.stylesheetHref).toBeNull();
	});

	it("falls back to productName for shellName/logoAlt and to /ap-admin for logoHref when overrides are empty strings", () => {
		registerCms({
			siteUrl: "https://example.org",
			templateKeys: [],
			seedPages: [],
			archives: [],
			translationStatus: [],
			admin: {
				branding: {
					productName: "Fallback Admin",
					shellName: "",
					logoAlt: "",
					logoHref: "",
				},
			},
		});

		const adminUi = resolveAstropressAdminUiConfig();
		// shellName falls back to productName when empty
		expect(adminUi.branding.shellName).toBe("Fallback Admin");
		// logoAlt falls back to productName when empty
		expect(adminUi.branding.logoAlt).toBe("Fallback Admin");
		// logoHref falls back to "/ap-admin" when empty
		expect(adminUi.branding.logoHref).toBe("/ap-admin");
	});
});
