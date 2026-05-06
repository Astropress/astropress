import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logAccessDeny } from "../src/access/audit-deny";
import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const recordAuditEventMock = vi.fn(async () => {});
vi.mock("../src/local-runtime-modules", async (orig) => {
	const real = (await orig()) as Record<string, unknown>;
	return {
		...real,
		loadLocalAdminStore: async () => ({
			recordAuditEvent: recordAuditEventMock,
		}),
	};
});

// BDD: logAccessDeny — every engine.can() deny should land in audit_events
//
// The page guard and form action handler call this helper before redirecting,
// so admins can review which subjects hit which actions and why. The summary
// column carries the engine's matched-policy reason so the audit trail is
// self-explanatory without joining back to the policy table.

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
});

describe("logAccessDeny", () => {
	it("Records an access:deny audit row with action id as resource and reason as summary", async () => {
		await logAccessDeny(locals, {
			subjectEmail: "editor@test.local",
			action: "users:invite",
			decision: {
				decision: "deny",
				reason: "No matching allow policy for users:invite.",
			},
		});

		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as
			| {
					user_email: string;
					action: string;
					resource_type: string;
					resource_id: string;
					summary: string;
			  }
			| undefined;
		expect(row).toBeDefined();
		expect(row?.user_email).toBe("editor@test.local");
		expect(row?.action).toBe("access:deny");
		expect(row?.resource_type).toBe("access");
		expect(row?.resource_id).toBe("users:invite");
		expect(row?.summary).toBe("No matching allow policy for users:invite.");
	});

	it("Falls back to a default summary when the engine reason is empty", async () => {
		await logAccessDeny(locals, {
			subjectEmail: "editor@test.local",
			action: "settings:edit",
			decision: { decision: "deny", reason: "" },
		});

		const row = db.prepare("SELECT summary FROM audit_events ORDER BY id DESC LIMIT 1").get() as
			| { summary: string }
			| undefined;
		expect(row?.summary).toMatch(/access denied/i);
	});

	describe("local-store fallback (no D1 binding)", () => {
		beforeEach(() => {
			recordAuditEventMock.mockClear();
		});

		it("Calls store.recordAuditEvent with the documented action/resource shape", async () => {
			await logAccessDeny(null, {
				subjectEmail: "editor@test.local",
				action: "users:invite",
				decision: { decision: "deny", reason: "denied for users:invite" },
			});
			expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
			expect(recordAuditEventMock).toHaveBeenCalledWith({
				userEmail: "editor@test.local",
				action: "access:deny",
				resourceType: "access",
				resourceId: "users:invite",
				summary: "denied for users:invite",
			});
		});

		it("Falls back to default summary when reason is empty (local path)", async () => {
			await logAccessDeny(null, {
				subjectEmail: "editor@test.local",
				action: "settings:edit",
				decision: { decision: "deny", reason: "" },
			});
			const call = recordAuditEventMock.mock.calls[0]?.[0] as {
				summary: string;
			};
			expect(call.summary).toBe("Access denied");
		});

		it("Swallows local-path failures (recordAuditEvent throws)", async () => {
			recordAuditEventMock.mockRejectedValueOnce(new Error("boom"));
			await expect(
				logAccessDeny(null, {
					subjectEmail: "editor@test.local",
					action: "x",
					decision: { decision: "deny", reason: "r" },
				}),
			).resolves.toBeUndefined();
		});
	});

	it("Swallows logging failures — a broken audit table never blocks the deny path", async () => {
		db.prepare("DROP TABLE audit_events").run();
		await expect(
			logAccessDeny(locals, {
				subjectEmail: "editor@test.local",
				action: "users:invite",
				decision: { decision: "deny", reason: "denied" },
			}),
		).resolves.toBeUndefined();
	});
});
