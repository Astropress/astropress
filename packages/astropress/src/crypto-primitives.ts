import { argon2id } from "@noble/hashes/argon2.js";
import { kmac256 } from "@noble/hashes/sha3-addons.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

const textEncoder = new TextEncoder();

const ARGON2_PREFIX = "v3:argon2id";
const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_ITERATIONS = 2;
const ARGON2_LANES = 1;
const ARGON2_HASH_LENGTH = 32;
const DEFAULT_SALT_LENGTH = 16;
const DEFAULT_KMAC_LENGTH = 32;

function encodeUtf8(value: string) {
  return textEncoder.encode(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function kmacContext(purpose: string) {
  return encodeUtf8(`astropress:${purpose}`);
}

export function createKmacDigest(value: string, secret: string, purpose: string, dkLen = DEFAULT_KMAC_LENGTH) {
  const digest = kmac256(encodeUtf8(secret), encodeUtf8(value), {
    dkLen,
    personalization: kmacContext(purpose),
  });
  return bytesToHex(digest);
}

export function hashPasswordArgon2id(
  password: string,
  options: {
    saltLength?: number;
    iterations?: number;
    memoryKiB?: number;
    parallelism?: number;
  } = {},
) {
  const salt = randomBytes(options.saltLength ?? DEFAULT_SALT_LENGTH);
  const iterations = options.iterations ?? ARGON2_ITERATIONS;
  const memoryKiB = options.memoryKiB ?? ARGON2_MEMORY_KIB;
  const parallelism = options.parallelism ?? ARGON2_LANES;
  const digest = argon2id(encodeUtf8(password), salt, {
    t: iterations,
    m: memoryKiB,
    p: parallelism,
    dkLen: ARGON2_HASH_LENGTH,
  });
  return `${ARGON2_PREFIX}$${iterations}$${memoryKiB}$${parallelism}$${bytesToBase64(salt)}$${bytesToBase64(digest)}`;
}

export function isArgon2idHash(storedHash: string) {
  return storedHash.startsWith(`${ARGON2_PREFIX}$`);
}

export function verifyArgon2idPassword(password: string, storedHash: string) {
  try {
    if (!isArgon2idHash(storedHash)) {
      return false;
    }

    const [prefix, iterationsText, memoryText, parallelismText, saltBase64, hashBase64] = storedHash.split("$");
    if (prefix !== ARGON2_PREFIX || !iterationsText || !memoryText || !parallelismText || !saltBase64 || !hashBase64) {
      return false;
    }

    const iterations = Number.parseInt(iterationsText, 10);
    const memoryKiB = Number.parseInt(memoryText, 10);
    const parallelism = Number.parseInt(parallelismText, 10);
    if (!iterations || !memoryKiB || !parallelism) {
      return false;
    }

    const salt = base64ToBytes(saltBase64);
    const expected = base64ToBytes(hashBase64);
    const actual = argon2id(encodeUtf8(password), salt, {
      t: iterations,
      m: memoryKiB,
      p: parallelism,
      dkLen: expected.length,
    });
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface MlDsaVerificationKey {
  algorithm: "ML-DSA-65";
  keyId: string;
  publicKey: string;
  encoding: "base64";
}

export function createMlDsaKeyPair(keyId: string, seed = randomBytes(32)) {
  const keys = ml_dsa65.keygen(seed);
  return {
    keyId,
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
    verification: {
      algorithm: "ML-DSA-65" as const,
      keyId,
      publicKey: bytesToBase64(keys.publicKey),
      encoding: "base64" as const,
    },
  };
}

export function signMlDsaMessage(message: string, secretKeyBase64: string) {
  return bytesToBase64(ml_dsa65.sign(encodeUtf8(message), base64ToBytes(secretKeyBase64)));
}

export function verifyMlDsaMessage(message: string, signatureBase64: string, publicKeyBase64: string) {
  return ml_dsa65.verify(
    base64ToBytes(signatureBase64),
    encodeUtf8(message),
    base64ToBytes(publicKeyBase64),
  );
}

export function secretKeyToBase64(secretKey: Uint8Array) {
  return bytesToBase64(secretKey);
}
