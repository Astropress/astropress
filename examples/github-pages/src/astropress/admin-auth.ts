import type { SessionUser } from "astropress";

export async function authenticateAdminUser(_email: string, _password: string): Promise<SessionUser | null> {
  throw new Error("Example app: admin auth wiring is documented here but not implemented for the static GitHub Pages demo.");
}
