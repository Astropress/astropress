import { EFF_SHORT_WORDLIST } from "./project-scaffold-passphrase-wordlist.js";

export { EFF_SHORT_WORDLIST };

export const PASSPHRASE_CHARS = "0123456789!@#$%^&*+";

function randomIndex(max: number): number {
	const arr = new Uint32Array(1);
	crypto.getRandomValues(arr);
	return (arr[0] as number) % max;
}

export function randomSecret(bytes = 24) {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(
		"base64url",
	);
}

export function generatePassphrase(): string {
	return Array.from({ length: 4 }, () => {
		const word = EFF_SHORT_WORDLIST[
			randomIndex(EFF_SHORT_WORDLIST.length)
		] as string;
		const char = PASSPHRASE_CHARS[
			randomIndex(PASSPHRASE_CHARS.length)
		] as string;
		return word + char;
	}).join("-");
}

export function createLocalBootstrapSecrets() {
	return {
		ADMIN_PASSWORD: generatePassphrase(),
		EDITOR_PASSWORD: generatePassphrase(),
		SESSION_SECRET: randomSecret(32),
	};
}
