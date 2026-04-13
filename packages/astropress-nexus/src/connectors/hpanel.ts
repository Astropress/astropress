const HPANEL_API = "https://developers.hostinger.com/api";

export type HPanelDiscoveryInput = {
  accessToken: string;
};

export type DiscoveredSite = {
  siteUrl: string;
  name: string;
  metadata: Record<string, unknown>;
};

type HPanelPlan = {
  domain: string;
  plan?: string;
  [key: string]: unknown;
};

export async function discoverHPanelSites(input: HPanelDiscoveryInput): Promise<DiscoveredSite[]> {
  const { accessToken } = input;

  const res = await fetch(`${HPANEL_API}/hosting/v1/shared-hosting`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`hPanel API failed: HTTP ${res.status}`);
  }

  const body = await res.json() as Record<string, unknown>;
  const plans = Array.isArray(body.data) ? (body.data as HPanelPlan[]) : [];

  return plans.map((plan) => ({
    siteUrl: `https://${plan.domain}`,
    name: plan.domain,
    metadata: {
      plan: plan.plan ?? "unknown",
    },
  }));
}
