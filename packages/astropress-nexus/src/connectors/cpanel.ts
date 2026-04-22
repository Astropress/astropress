export type CPanelDiscoveryInput = {
	host: string;
	username: string;
	password: string;
};

export type DiscoveredSite = {
	siteUrl: string;
	name: string;
	metadata: Record<string, unknown>;
};

type SoftaculousInstall = {
	stype: string;
	softurl: string;
	admin_username?: string;
	[key: string]: unknown;
};

export async function discoverCPanelWordPressSites(
	input: CPanelDiscoveryInput,
): Promise<DiscoveredSite[]> {
	const { host, username, password } = input;

	const basicAuth = btoa(`${username}:${password}`);
	const softaculousUrl = `https://${host}:2083/frontend/paper_lantern/softaculous/index.live.php?act=installations&display=JSON`;

	const res = await fetch(softaculousUrl, {
		headers: {
			Authorization: `Basic ${basicAuth}`,
			Accept: "application/json",
		},
	});

	if (!res.ok) {
		throw new Error(`Softaculous API failed: HTTP ${res.status}`);
	}

	let installs: SoftaculousInstall[];
	try {
		const body = (await res.json()) as unknown;
		installs = Array.isArray(body) ? (body as SoftaculousInstall[]) : [];
	} catch {
		installs = [];
	}

	return installs
		.filter((install) => install.stype === "wordpress")
		.map((install) => ({
			siteUrl: install.softurl,
			name: install.softurl,
			metadata: {
				// adminUsername included for reference; password intentionally omitted
				...(install.admin_username
					? { adminUsername: install.admin_username }
					: {}),
			},
		}));
}
