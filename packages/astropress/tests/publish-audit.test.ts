import { describe, expect, it, vi } from "vitest";
import { recordPublishAudit } from "../src/admin-action-publish";

const actor = {
	email: "admin@example.com",
	role: "admin" as const,
	name: "Admin",
};

function buildD1Locals() {
	const run = vi.fn().mockResolvedValue(undefined);
	const bind = vi.fn().mockReturnValue({ run });
	const prepare = vi.fn().mockReturnValue({ bind });
	const locals = {
		runtime: { env: { DB: { prepare } } },
	} as unknown as App.Locals;
	return { locals, prepare, bind, run };
}

describe("recordPublishAudit", () => {
	it("writes a deployment.trigger event for a successful build", async () => {
		const { locals, bind } = buildD1Locals();

		await recordPublishAudit(locals, actor, {
			hookType: "cloudflare-pages",
			result: { ok: true, buildId: "build-123" },
		});

		expect(bind).toHaveBeenCalledWith(
			"admin@example.com",
			"deployment.trigger",
			"deployment",
			"build-123",
			"Triggered cloudflare-pages publish (build build-123).",
		);
	});

	it("writes a deployment.failure event with the error message when the hook fails", async () => {
		const { locals, bind } = buildD1Locals();

		await recordPublishAudit(locals, actor, {
			hookType: "vercel",
			result: { ok: false, error: "deploy hook returned 503" },
		});

		expect(bind).toHaveBeenCalledWith(
			"admin@example.com",
			"deployment.failure",
			"deployment",
			"vercel",
			"vercel publish failed: deploy hook returned 503",
		);
	});

	it("falls back to the hook type as resourceId when buildId is absent", async () => {
		const { locals, bind } = buildD1Locals();

		await recordPublishAudit(locals, actor, {
			hookType: "github-actions",
			result: { ok: true },
		});

		expect(bind).toHaveBeenCalledWith(
			"admin@example.com",
			"deployment.trigger",
			"deployment",
			"github-actions",
			"Triggered github-actions publish.",
		);
	});
});
