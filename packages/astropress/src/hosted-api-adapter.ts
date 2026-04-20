import {
	type AstropressPlatformAdapter,
	type AuthStore,
	type AuthUser,
	type ContentStore,
	type ContentStoreRecord,
	type MediaAssetRecord,
	type MediaStore,
	type ProviderCapabilities,
	type RevisionRecord,
	type RevisionStore,
	assertProviderContract,
	normalizeProviderCapabilities,
} from "./platform-contracts";

type AstropressFetch = typeof fetch;

export interface AstropressHostedApiAdapterOptions {
	providerName: ProviderCapabilities["name"];
	apiBaseUrl: string;
	accessToken?: string;
	previewBaseUrl?: string;
	defaultCapabilities?: Partial<Omit<ProviderCapabilities, "name">>;
	fetchImpl?: AstropressFetch;
}

function joinApiUrl(baseUrl: string, path: string) {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		throw new Error(
			`Astropress hosted API request failed with ${response.status}.`,
		);
	}
	return (await response.json()) as T;
}

function createHeaders(accessToken?: string, extra?: Record<string, string>) {
	return {
		"content-type": "application/json",
		...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
		...extra,
	};
}

export function createAstropressHostedApiAdapter(
	options: AstropressHostedApiAdapterOptions,
): AstropressPlatformAdapter {
	const fetchImpl = options.fetchImpl ?? fetch;
	const capabilities = normalizeProviderCapabilities({
		name: options.providerName,
		hostedAdmin: true,
		previewEnvironments: true,
		serverRuntime: true,
		database: true,
		objectStorage: true,
		gitSync: true,
		...options.defaultCapabilities,
	});

	const requestJson = async <T>(
		path: string,
		init: RequestInit = {},
	): Promise<T> => {
		const response = await fetchImpl(joinApiUrl(options.apiBaseUrl, path), {
			...init,
			headers: createHeaders(
				options.accessToken,
				init.headers as Record<string, string> | undefined,
			),
		});
		return readJson<T>(response);
	};

	const content: ContentStore = {
		async list(kind) {
			const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
			return requestJson<ContentStoreRecord[]>(`content${query}`);
		},
		async get(id) {
			return requestJson<ContentStoreRecord | null>(
				`content/${encodeURIComponent(id)}`,
			);
		},
		async save(record) {
			return requestJson<ContentStoreRecord>("content", {
				method: "POST",
				body: JSON.stringify(record),
			});
		},
		async delete(id) {
			await requestJson<{ ok: true }>(`content/${encodeURIComponent(id)}`, {
				method: "DELETE",
			});
		},
	};

	const media: MediaStore = {
		async put(asset) {
			return requestJson<MediaAssetRecord>("media", {
				method: "POST",
				body: JSON.stringify(asset),
			});
		},
		async get(id) {
			return requestJson<MediaAssetRecord | null>(
				`media/${encodeURIComponent(id)}`,
			);
		},
		async delete(id) {
			await requestJson<{ ok: true }>(`media/${encodeURIComponent(id)}`, {
				method: "DELETE",
			});
		},
	};

	const revisions: RevisionStore = {
		async list(recordId) {
			return requestJson<RevisionRecord[]>(
				`revisions?recordId=${encodeURIComponent(recordId)}`,
			);
		},
		async append(revision) {
			return requestJson<RevisionRecord>("revisions", {
				method: "POST",
				body: JSON.stringify(revision),
			});
		},
	};

	const auth: AuthStore = {
		async signIn(email, password) {
			return requestJson<AuthUser | null>("auth/sign-in", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			});
		},
		async signOut(sessionId) {
			await requestJson<{ ok: true }>("auth/sign-out", {
				method: "POST",
				body: JSON.stringify({ sessionId }),
			});
		},
		async getSession(sessionId) {
			return requestJson<AuthUser | null>(
				`auth/session/${encodeURIComponent(sessionId)}`,
			);
		},
	};

	return assertProviderContract({
		capabilities,
		content,
		media,
		revisions,
		auth,
		preview: options.previewBaseUrl
			? {
					async create(input) {
						return {
							url: joinApiUrl(
								options.previewBaseUrl as string,
								`preview/${encodeURIComponent(input.recordId)}`,
							),
							expiresAt: input.expiresAt,
						};
					},
				}
			: undefined,
	});
}
