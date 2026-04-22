import { DatabaseSync } from "node:sqlite";
import {
	recordEmergencyRevokeAuditEvent,
	revokeApiTokensInDb,
	revokeSessionsInDb,
} from "./sqlite-runtime/auth-emergency-revoke.js";

export type AuthRevokeScope = "all" | "sessions" | "tokens";

export interface AuthEmergencyRevokeInput {
	dbPath: string;
	scope: AuthRevokeScope;
	userEmail?: string;
}

export interface AuthEmergencyRevokeReport {
	dbPath: string;
	scope: AuthRevokeScope;
	userEmail: string | null;
	sessionsRevoked: number;
	tokensRevoked: number;
}

export function runAuthEmergencyRevokeForCli(
	input: AuthEmergencyRevokeInput,
): AuthEmergencyRevokeReport {
	const { dbPath, scope, userEmail } = input;
	const db = new DatabaseSync(dbPath);

	try {
		let sessionsRevoked = 0;
		let tokensRevoked = 0;

		if (scope === "all" || scope === "sessions") {
			sessionsRevoked = revokeSessionsInDb(db, userEmail);
		}

		if (scope === "all" || scope === "tokens") {
			tokensRevoked = revokeApiTokensInDb(db);
		}

		recordEmergencyRevokeAuditEvent(
			db,
			scope,
			userEmail ?? null,
			sessionsRevoked,
			tokensRevoked,
		);

		return {
			dbPath,
			scope,
			userEmail: userEmail ?? null,
			sessionsRevoked,
			tokensRevoked,
		};
	} finally {
		db.close();
	}
}
