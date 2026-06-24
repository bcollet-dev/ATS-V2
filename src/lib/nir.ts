import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.NIR_ENCRYPTION_KEY!, "hex");

export function encryptNir(nir: string): { encrypted: Buffer; iv: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(nir, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([encrypted, authTag]),
    iv,
  };
}

export function decryptNir(encrypted: Buffer, iv: Buffer): string {
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export function maskNir(nir: string): string {
  return "●".repeat(nir.length - 2) + nir.slice(-2);
}
