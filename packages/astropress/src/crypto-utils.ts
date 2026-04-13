import {
  createKmacDigest,
  hashPasswordArgon2id,
  isArgon2idHash,
  verifyArgon2idPassword,
} from "./crypto-primitives";

export async function hashPassword(password: string, saltLength = 16, iterations = 2): Promise<string> {
  return hashPasswordArgon2id(password, { saltLength, iterations });
}

export function isLegacyHash(storedHash: string): boolean {
  return !isArgon2idHash(storedHash);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return verifyArgon2idPassword(password, storedHash);
}

export async function createSessionTokenDigest(sessionToken: string, secret: string): Promise<string> {
  return createKmacDigest(sessionToken, secret, "session-token");
}
