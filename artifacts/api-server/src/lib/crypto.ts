import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY_ENV = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer {
  if (KEY_ENV && KEY_ENV.length >= 32) {
    return Buffer.from(KEY_ENV.slice(0, 32), "utf8");
  }
  // Fallback deterministic key for dev (NOT for production)
  return Buffer.from("botfactory_dev_key_32bytes_padded", "utf8");
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const [ivHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !encryptedHex) return ciphertext;
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}
