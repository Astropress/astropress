export const ASTROPRESS_ADMIN_PRODUCT_NAME = "Astropress Admin";
export const ASTROPRESS_ADMIN_APP_NAME = "Astropress";

const legacyAdminSuffixPatterns = [
  /\s+\|\s+Fleet Farming Admin$/i,
  /\s+-\s+Fleet Farming Admin$/i,
  /\s+\|\s+Fleet Farming$/i,
  /\s+-\s+Fleet Farming$/i,
];

function stripLegacyAdminSuffixes(value: string): string {
  return legacyAdminSuffixPatterns.reduce((current, pattern) => current.replace(pattern, ""), value.trim());
}

export function buildAstropressAdminDocumentTitle(title: string): string {
  const baseTitle = stripLegacyAdminSuffixes(title);
  return baseTitle ? `${baseTitle} | ${ASTROPRESS_ADMIN_PRODUCT_NAME}` : ASTROPRESS_ADMIN_PRODUCT_NAME;
}
