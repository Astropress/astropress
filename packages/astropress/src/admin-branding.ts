import { resolveAstropressAdminUiConfig } from "./admin-ui";

export const ASTROPRESS_ADMIN_PRODUCT_NAME = "Astropress Admin";
export const ASTROPRESS_ADMIN_APP_NAME = "Astropress";

export function buildAstropressAdminDocumentTitle(title: string): string {
  const productName = resolveAstropressAdminUiConfig().branding.productName;
  const trimmed = title.trim();
  return trimmed ? `${trimmed} | ${productName}` : productName;
}
