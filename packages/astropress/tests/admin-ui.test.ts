import { afterEach, describe, expect, it } from "vitest";

import { buildAstropressAdminDocumentTitle } from "../src/admin-branding";
import { getCmsConfig, peekCmsConfig, registerCms } from "../src/config";
import { adminLabels, getAdminLabel, resolveAstropressAdminUiConfig } from "../src/admin-ui";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function restoreConfig(config: ReturnType<typeof peekCmsConfig>) {
  (globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[CMS_CONFIG_KEY] = config ?? null;
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
    expect(buildAstropressAdminDocumentTitle("Dashboard")).toBe("Dashboard | Astropress Admin");
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
    expect(buildAstropressAdminDocumentTitle("Dashboard")).toBe("Dashboard | Client Console Admin");
  });

  it("exposes locale-aware admin labels in Spanish when locale is es", () => {
    restoreConfig(null);
    expect(getAdminLabel("saveButton", "es")).toBe("Guardar");
    expect(getAdminLabel("publishButton", "es")).toBe("Publicar");
    expect(getAdminLabel("signOut", "es")).toBe("Cerrar sesión");
    expect(getAdminLabel("loginHeading", "es")).toBe("Acceder al panel de administración");
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

  it("falls back to English when locale is unknown", () => {
    restoreConfig(null);
    expect(getAdminLabel("saveButton", "zz")).toBe(adminLabels.en.saveButton);
    expect(getAdminLabel("publishButton", "xx")).toBe(adminLabels.en.publishButton);
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
