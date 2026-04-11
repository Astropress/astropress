export type AstropressDataServices =
  | "none"
  | "cloudflare"
  | "supabase"
  | "appwrite"
  | "pocketbase"
  | "neon"
  | "nhost"
  | "runway"
  | "custom";

export interface AstropressDataServiceTarget {
  id: AstropressDataServices;
  label: string;
  kind: "none" | "full-stack-services" | "db-and-storage" | "database-only" | "app-platform" | "custom";
  providesDatabase: boolean;
  providesObjectStorage: boolean;
  providesAuth: boolean;
  notes: string;
}

const dataServiceTargets: Record<AstropressDataServices, AstropressDataServiceTarget> = {
  none: {
    id: "none",
    label: "No Hosted Content Services",
    kind: "none",
    providesDatabase: false,
    providesObjectStorage: false,
    providesAuth: false,
    notes: "Static publishing path without a hosted Astropress admin backend.",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare D1 / R2 / Workers",
    kind: "full-stack-services",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Astropress-managed edge/runtime path using Workers, D1, and R2.",
  },
  supabase: {
    id: "supabase",
    label: "Supabase",
    kind: "db-and-storage",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Hosted database, storage, and service primitives. The Astro app still needs an app host.",
  },
  appwrite: {
    id: "appwrite",
    label: "Appwrite",
    kind: "full-stack-services",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Backend services platform for data, auth, and storage behind a separate Astro host.",
  },
  pocketbase: {
    id: "pocketbase",
    label: "PocketBase",
    kind: "full-stack-services",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Lightweight backend-in-one-box path. Treat as preview or self-hosted infrastructure.",
  },
  neon: {
    id: "neon",
    label: "Neon",
    kind: "database-only",
    providesDatabase: true,
    providesObjectStorage: false,
    providesAuth: false,
    notes: "Database-only service. Astropress still needs auth, storage, and runtime glue elsewhere.",
  },
  nhost: {
    id: "nhost",
    label: "Nhost",
    kind: "full-stack-services",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Supabase-like backend services option behind a separate Astro app host.",
  },
  runway: {
    id: "runway",
    label: "Runway",
    kind: "app-platform",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Bundled platform path with Astro app hosting and managed runtime expectations.",
  },
  custom: {
    id: "custom",
    label: "Custom Content Services",
    kind: "custom",
    providesDatabase: true,
    providesObjectStorage: true,
    providesAuth: true,
    notes: "Bring your own data, auth, media, and service implementation.",
  },
};

export function listAstropressDataServiceTargets(): AstropressDataServiceTarget[] {
  return Object.values(dataServiceTargets);
}

export function getAstropressDataServiceTarget(
  dataServices: AstropressDataServices,
): AstropressDataServiceTarget {
  return dataServiceTargets[dataServices];
}
