export type AstropressAppHost =
  | "github-pages"
  | "cloudflare-pages"
  | "vercel"
  | "netlify"
  | "render-static"
  | "render-web"
  | "gitlab-pages"
  | "fly-io"
  | "coolify"
  | "digitalocean"
  | "railway"
  | "runway"
  | "custom";

export interface AstropressAppHostTarget {
  id: AstropressAppHost;
  label: string;
  runtime: "static" | "edge" | "serverless" | "web-service" | "app-platform" | "custom";
  supportsStatic: boolean;
  supportsServerRuntime: boolean;
  notes: string;
}

const appHostTargets: Record<AstropressAppHost, AstropressAppHostTarget> = {
  "github-pages": {
    id: "github-pages",
    label: "GitHub Pages",
    runtime: "static",
    supportsStatic: true,
    supportsServerRuntime: false,
    notes: "Static-only hosting for prerendered Astro output.",
  },
  "cloudflare-pages": {
    id: "cloudflare-pages",
    label: "Cloudflare Pages",
    runtime: "edge",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Pages plus Workers for static output and hosted server/runtime paths.",
  },
  vercel: {
    id: "vercel",
    label: "Vercel",
    runtime: "serverless",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Good fit for Astro static or SSR deployments on the Hobby tier.",
  },
  netlify: {
    id: "netlify",
    label: "Netlify",
    runtime: "serverless",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Good fit for Astro static or function-backed deployments on the free tier.",
  },
  "render-static": {
    id: "render-static",
    label: "Render Static Site",
    runtime: "static",
    supportsStatic: true,
    supportsServerRuntime: false,
    notes: "Static site hosting on Render without a long-running Astro app process.",
  },
  "render-web": {
    id: "render-web",
    label: "Render Web Service",
    runtime: "web-service",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Node web-service hosting for Astro server/runtime deployments.",
  },
  "gitlab-pages": {
    id: "gitlab-pages",
    label: "GitLab Pages",
    runtime: "static",
    supportsStatic: true,
    supportsServerRuntime: false,
    notes: "Static-only hosting for prerendered Astro output.",
  },
  "fly-io": {
    id: "fly-io",
    label: "Fly.io",
    runtime: "web-service",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Docker-based Node web service on Fly.io; deploy with flyctl.",
  },
  coolify: {
    id: "coolify",
    label: "Coolify",
    runtime: "web-service",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Self-hosted PaaS (Coolify) deploying via git push or Docker Compose.",
  },
  digitalocean: {
    id: "digitalocean",
    label: "DigitalOcean App Platform",
    runtime: "web-service",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "DigitalOcean App Platform for Node web service deployments.",
  },
  railway: {
    id: "railway",
    label: "Railway",
    runtime: "web-service",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Railway container platform for Node web service deployments. Paid — usage-based billing, no free tier.",
  },
  runway: {
    id: "runway",
    label: "Runway",
    runtime: "app-platform",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Bundled app-platform path for Astro app hosting and operational workflows.",
  },
  custom: {
    id: "custom",
    label: "Custom App Host",
    runtime: "custom",
    supportsStatic: true,
    supportsServerRuntime: true,
    notes: "Bring your own Astro hosting environment and deployment pipeline.",
  },
};

export function listAstropressAppHosts(): AstropressAppHostTarget[] {
  return Object.values(appHostTargets);
}

export function getAstropressAppHostTarget(appHost: AstropressAppHost): AstropressAppHostTarget {
  return appHostTargets[appHost];
}
