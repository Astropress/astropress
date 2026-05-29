// Ambient declarations for runtime modules that ship no TypeScript types.
//
// This file has no top-level import/export, so it is a *script* — `declare
// module` here declares genuine ambient modules (not module augmentations,
// which is what the same blocks become inside the module-scoped env.d.ts).
// The surfaces are scoped to exactly what we call, mirroring the local
// HTMLRewriter convention in env.d.ts rather than pulling whole @types packages.

// Bun's built-in sqlite module — only the `Database` constructor, which
// `loadSqliteDatabase()` casts through `unknown` anyway.
declare module "bun:sqlite" {
	export class Database {
		constructor(filename?: string);
	}
}

// nodemailer ships no types and we don't depend on `@types/nodemailer`; declare
// only the `createTransport` / `sendMail` surface `transactional-email.ts` uses.
declare module "nodemailer" {
	interface SendMailOptions {
		from?: string;
		to?: string | string[];
		subject?: string;
		html?: string;
		text?: string;
	}
	interface Transporter {
		sendMail(options: SendMailOptions): Promise<unknown>;
	}
	interface TransportOptions {
		host?: string;
		port?: number;
		secure?: boolean;
		auth?: { user?: string; pass?: string } | undefined;
	}
	const nodemailer: { createTransport(options: TransportOptions): Transporter };
	export default nodemailer;
}
