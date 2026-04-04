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

export async function hashPassword(password: string, saltLength = 32, iterations = 100000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(saltLength));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
    512 // 64 bytes = 512 bits
  );

  const saltBase64 = bytesToBase64(salt);
  const hashBase64 = bytesToBase64(new Uint8Array(hashBuffer));

  return `${iterations}$${saltBase64}$${hashBase64}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
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
        salt: salt,
        iterations: iterations,
        hash: "SHA-256",
      },
      await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]),
      512
    );

    return constantTimeEqual(expectedHash, new Uint8Array(hashBuffer));
  } catch {
    return false;
  }
}
