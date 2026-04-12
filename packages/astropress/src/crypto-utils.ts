function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Password hashing — PBKDF2-HMAC-SHA-512, 600 000 iterations (OWASP 2024)
// ---------------------------------------------------------------------------
//
// Stored format (v2):  "v2:<iterations>$<saltBase64>$<hashBase64>"
// Legacy format (v1):  "<iterations>$<saltBase64>$<hashBase64>"  (SHA-256, read-only)
//
// `verifyPassword` handles both formats for backward compatibility.
// New passwords always use the v2 format.

const V2_PREFIX = "v2:";
const V2_HASH = "SHA-512";
const V2_ITERATIONS = 600_000;

/**
 * Hash a password using PBKDF2-HMAC-SHA-512 (OWASP 2024 recommendation).
 * Returns a versioned string: `v2:<iterations>$<saltBase64>$<hashBase64>`.
 *
 * Pure Web Crypto API — compatible with Node.js, Bun, and Cloudflare Workers.
 */
export async function hashPassword(password: string, saltLength = 32, iterations = V2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: V2_HASH,
    },
    await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
    512, // 64 bytes = 512 bits
  );

  const saltBase64 = bytesToBase64(salt);
  const hashBase64 = bytesToBase64(new Uint8Array(hashBuffer));

  return `${V2_PREFIX}${iterations}$${saltBase64}$${hashBase64}`;
}

/**
 * Returns `true` when `storedHash` was produced by the legacy SHA-256 path
 * (no `v2:` prefix). Use this to identify accounts that need re-hashing on
 * next successful login.
 */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith(V2_PREFIX);
}

/**
 * Verify a password against a stored hash. Handles both v2 (SHA-512) and
 * legacy v1 (SHA-256) formats for backward compatibility.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    let hashAlgorithm: string;
    let rest: string;

    if (storedHash.startsWith(V2_PREFIX)) {
      hashAlgorithm = "SHA-512";
      rest = storedHash.slice(V2_PREFIX.length);
    } else {
      // Legacy format: SHA-256 (read-only backward compat)
      hashAlgorithm = "SHA-256";
      rest = storedHash;
    }

    const [iterationsStr, saltBase64, hashBase64] = rest.split("$");
    const iterations = parseInt(iterationsStr, 10);

    if (!iterations || !saltBase64 || !hashBase64) {
      return false;
    }

    const salt = base64ToBytes(saltBase64);
    const expectedHash = base64ToBytes(hashBase64);

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: hashAlgorithm,
      },
      await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
      512,
    );

    return constantTimeEqual(expectedHash, new Uint8Array(hashBuffer));
  } catch {
    return false;
  }
}

export async function createSessionTokenDigest(sessionToken: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionToken));
  return bytesToHex(new Uint8Array(digest));
}
