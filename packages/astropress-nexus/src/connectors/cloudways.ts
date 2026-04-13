const CLOUDWAYS_API = "https://api.cloudways.com/api/v1";

/** WordPress-based app types on the Cloudways platform. */
const WORDPRESS_APP_TYPES = new Set(["wordpress", "woocommerce", "wordpress_lite"]);

export type CloudwaysDiscoveryInput = {
  email: string;
  apiKey: string;
};

export type DiscoveredSite = {
  siteUrl: string;
  name: string;
  metadata: Record<string, unknown>;
};

async function getAccessToken(email: string, apiKey: string): Promise<string> {
  const res = await fetch(`${CLOUDWAYS_API}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, api_key: apiKey }),
  });

  if (!res.ok) {
    throw new Error(`Cloudways auth failed: HTTP ${res.status}`);
  }

  const body = await res.json() as Record<string, unknown>;
  const token = body.access_token;
  if (typeof token !== "string") {
    throw new Error("Cloudways auth response missing access_token");
  }
  return token;
}

export async function discoverCloudwaySites(input: CloudwaysDiscoveryInput): Promise<DiscoveredSite[]> {
  const { email, apiKey } = input;

  const accessToken = await getAccessToken(email, apiKey);

  const res = await fetch(`${CLOUDWAYS_API}/app`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Cloudways /app failed: HTTP ${res.status}`);
  }

  const body = await res.json() as Record<string, unknown>;
  const apps = Array.isArray(body.apps) ? body.apps : [];

  return (apps as Array<Record<string, unknown>>)
    .filter((app) => {
      const appType = (app.application as Record<string, unknown>)?.type;
      return typeof appType === "string" && WORDPRESS_APP_TYPES.has(appType);
    })
    .map((app) => ({
      siteUrl: `https://${app.app_fqdn as string}`,
      name: (app.label as string) ?? String(app.id),
      metadata: {
        appId: app.id,
        appType: (app.application as Record<string, unknown>)?.type,
      },
    }));
}
