/**
 * Type augmentation: `Astro.locals.access` (lazily populated by
 * `getAccessContext` / the access middleware) carries the per-request
 * subject + policy engine. Optional because the helper short-circuits to
 * null when no admin user is on the session.
 *
 * This module exports nothing at runtime — it only contributes the
 * ambient `App.Locals` augmentation.
 */

import type { AuthUser } from "../platform-contracts";
import type { AccessContext } from "./request-context";

declare global {
	namespace App {
		interface Locals {
			access?: AccessContext;
			adminUser?: AuthUser & { name?: string };
			csrfToken?: string;
		}
	}
}
