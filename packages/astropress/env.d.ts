/// <reference types="astro/client" />

import type { AccessContext } from "./src/access/request-context";
import type { AuthUser } from "./src/platform-contracts";

declare global {
	namespace App {
		interface Locals {
			access?: AccessContext;
			adminUser?: AuthUser & { name?: string };
			csrfToken?: string;
		}
	}
}
