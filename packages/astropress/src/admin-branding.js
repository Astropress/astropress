import { resolveAstropressAdminUiConfig } from "./admin-ui.js";
const ASTROPRESS_ADMIN_PRODUCT_NAME = "Astropress Admin";
const ASTROPRESS_ADMIN_APP_NAME = "Astropress";
const legacyAdminSuffixPatterns = [
  /\s+\|\s+Fleet Farming Admin$/i,
  /\s+-\s+Fleet Farming Admin$/i,
  /\s+\|\s+Fleet Farming$/i,
  /\s+-\s+Fleet Farming$/i
];
function stripLegacyAdminSuffixes(value) {
  return legacyAdminSuffixPatterns.reduce((current, pattern) => current.replace(pattern, ""), value.trim());
}
function buildAstropressAdminDocumentTitle(title) {
  const baseTitle = stripLegacyAdminSuffixes(title);
  const productName = resolveAstropressAdminUiConfig().branding.productName;
  return baseTitle ? `${baseTitle} | ${productName}` : productName;
}
export {
  ASTROPRESS_ADMIN_APP_NAME,
  ASTROPRESS_ADMIN_PRODUCT_NAME,
  buildAstropressAdminDocumentTitle
};
