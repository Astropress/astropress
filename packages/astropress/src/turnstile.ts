import { getLoginSecurityConfig, isProductionRuntime } from "./runtime-env";

interface TurnstileVerificationResult {
	ok: boolean;
	error?: string;
}

interface TurnstileResponsePayload {
	success?: boolean;
	"error-codes"?: string[];
}

export function isTurnstileEnabled(locals?: App.Locals | null) {
	return Boolean(getLoginSecurityConfig(locals).turnstileSecretKey);
}

export async function verifyTurnstileToken(input: {
	token: string | null | undefined;
	ipAddress?: string | null;
	locals?: App.Locals | null;
	requireConfigured?: boolean;
}): Promise<TurnstileVerificationResult> {
	const { turnstileSecretKey } = getLoginSecurityConfig(input.locals);
	if (!turnstileSecretKey) {
		if (input.requireConfigured && isProductionRuntime()) {
			return { ok: false, error: "Security challenge is not configured." };
		}

		return { ok: true };
	}

	const token = input.token?.trim();
	if (!token) {
		return { ok: false, error: "Security challenge is required." };
	}

	const payload = new URLSearchParams({
		secret: turnstileSecretKey,
		response: token,
	});

	if (input.ipAddress) {
		payload.set("remoteip", input.ipAddress);
	}

	try {
		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: payload,
			},
		);

		if (!response.ok) {
			return { ok: false, error: "Security challenge could not be verified." };
		}

		const result = (await response.json()) as TurnstileResponsePayload;
		if (!result.success) {
			return {
				ok: false,
				error:
					result["error-codes"]?.join(", ") || "Security challenge failed.",
			};
		}

		return { ok: true };
	} catch {
		return { ok: false, error: "Security challenge could not be verified." };
	}
}
