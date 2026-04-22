// ─── Password Reset Actions ───────────────────────────────────────────────────
// Extracted from runtime-actions-users.ts to keep that file under the 400-line limit.

import { normalizeEmail } from "./admin-normalizers";
import { getAdminDb, withLocalStoreFallback } from "./admin-store-dispatch";
import { createKmacDigest } from "./crypto-primitives";
import { hashPassword } from "./crypto-utils";
import { recordD1Audit } from "./d1-audit";
import type { Actor } from "./persistence-types";
import { getAstropressRootSecret } from "./runtime-env";

async function hashOpaqueToken(token: string) {
	return createKmacDigest(
		token,
		getAstropressRootSecret(),
		"password-reset-token",
	);
}

async function getD1PasswordResetToken(
	rawToken: string,
	locals?: App.Locals | null,
) {
	const db = getAdminDb(locals);
	if (!db || !rawToken.trim()) {
		return null;
	}

	const row = await db
		.prepare(
			`
        SELECT t.id, t.user_id, t.expires_at, t.consumed_at,
               u.email, u.name, u.role, u.active
        FROM password_reset_tokens t
        JOIN admin_users u ON u.id = t.user_id
        WHERE t.token_hash = ?
        LIMIT 1
      `,
		)
		.bind(await hashOpaqueToken(rawToken))
		.first<{
			id: string;
			user_id: number;
			expires_at: string;
			consumed_at: string | null;
			email: string;
			name: string;
			role: "admin" | "editor";
			active: number;
		}>();

	if (
		!row ||
		row.consumed_at ||
		row.active !== 1 ||
		Date.parse(row.expires_at) < Date.now()
	) {
		return null;
	}

	return row;
}

export async function createRuntimePasswordResetToken(
	email: string,
	actor?: Actor | null,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const normalizedEmail = normalizeEmail(email);
			if (!normalizedEmail) {
				return { ok: false as const, error: "Email is required." };
			}

			const user = await db
				.prepare(
					`
            SELECT id, email, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
				)
				.bind(normalizedEmail)
				.first<{
					id: number;
					email: string;
					role: "admin" | "editor";
					name: string;
				}>();

			if (!user) {
				return actor
					? { ok: false as const, error: "That admin user could not be found." }
					: { ok: true as const, resetUrl: null as string | null };
			}

			await db
				.prepare(
					`
            UPDATE password_reset_tokens
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND consumed_at IS NULL
          `,
				)
				.bind(user.id)
				.run();

			const rawToken = crypto.randomUUID();
			const tokenId = `reset-${crypto.randomUUID()}`;
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

			await db
				.prepare(
					`
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
            VALUES (?, ?, ?, ?, ?)
          `,
				)
				.bind(
					tokenId,
					user.id,
					await hashOpaqueToken(rawToken),
					expiresAt,
					actor?.email ?? null,
				)
				.run();

			if (actor) {
				await recordD1Audit(
					locals,
					actor,
					"auth.password_reset_issue",
					"auth",
					normalizedEmail,
					`Issued a password reset link for ${normalizedEmail}.`,
				);
			}

			return {
				ok: true as const,
				resetUrl: `/ap-admin/reset-password?token=${encodeURIComponent(rawToken)}`,
			};
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.createPasswordResetToken(email, actor ?? null),
	);
}

export async function getRuntimePasswordResetRequest(
	rawToken: string,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async () => {
			const row = await getD1PasswordResetToken(rawToken, locals);
			if (!row) {
				return null;
			}
			return {
				email: row.email,
				name: row.name,
				role: row.role,
				expiresAt: row.expires_at,
			};
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.getPasswordResetRequest(rawToken),
	);
}

export async function consumeRuntimePasswordResetToken(
	rawToken: string,
	password: string,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const trimmedPassword = password.trim();
			if (trimmedPassword.length < 12) {
				return {
					ok: false as const,
					error: "Password must be at least 12 characters.",
				};
			}

			const row = await getD1PasswordResetToken(rawToken, locals);
			if (!row) {
				return {
					ok: false as const,
					error: "That password reset link is invalid or has expired.",
				};
			}

			await db
				.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?")
				.bind(await hashPassword(trimmedPassword), row.user_id)
				.run();
			await db
				.prepare(
					"UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?",
				)
				.bind(row.id)
				.run();
			await db
				.prepare(
					`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `,
				)
				.bind(row.user_id)
				.run();

			await recordD1Audit(
				locals,
				{ email: row.email, role: row.role, name: row.name },
				"auth.password_reset_complete",
				"auth",
				row.email,
				`${row.email} completed a password reset.`,
			);

			return {
				ok: true as const,
				user: {
					email: row.email,
					role: row.role,
					name: row.name,
				},
			};
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.consumePasswordResetToken(rawToken, password),
	);
}
