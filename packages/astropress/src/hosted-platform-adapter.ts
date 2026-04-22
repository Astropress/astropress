import {
	type AstropressInMemoryPlatformAdapterOptions,
	createAstropressInMemoryPlatformAdapter,
} from "./in-memory-platform-adapter";
import {
	type AstropressPlatformAdapter,
	type ProviderCapabilities,
	assertProviderContract,
	normalizeProviderCapabilities,
} from "./platform-contracts";

export interface AstropressHostedPlatformAdapterOptions
	extends Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> {
	providerName: ProviderCapabilities["name"];
	defaultCapabilities?: Partial<Omit<ProviderCapabilities, "name">>;
	backingAdapter?: AstropressPlatformAdapter;
}

export function createAstropressHostedPlatformAdapter(
	options: AstropressHostedPlatformAdapterOptions,
): AstropressPlatformAdapter {
	const capabilities = {
		name: options.providerName,
		hostedAdmin: true,
		previewEnvironments: true,
		serverRuntime: true,
		database: true,
		objectStorage: true,
		gitSync: true,
		...options.defaultCapabilities,
	} satisfies Pick<ProviderCapabilities, "name"> &
		Partial<Omit<ProviderCapabilities, "name">>;

	const baseAdapter =
		options.backingAdapter ??
		createAstropressInMemoryPlatformAdapter({
			...options,
			capabilities,
		});

	return assertProviderContract({
		...baseAdapter,
		capabilities: normalizeProviderCapabilities({
			...baseAdapter.capabilities,
			...capabilities,
		}),
	});
}
