function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password, saltLength = 32, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
    512,
  );

  return `${iterations}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(hashBuffer))}`;
}

export async function verifyPassword(password, storedHash) {
  try {
    const [iterationsStr, saltBase64, hashBase64] = storedHash.split("$");
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
        salt,
        iterations,
        hash: "SHA-256",
      },
      await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
      512,
    );

    return constantTimeEqual(expectedHash, new Uint8Array(hashBuffer));
  } catch {
    return false;
  }
}

export async function createSessionTokenDigest(sessionToken, secret) {
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
