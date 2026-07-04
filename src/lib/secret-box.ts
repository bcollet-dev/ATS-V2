import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "v1";

function encryptionKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY || process.env.NIR_ENCRYPTION_KEY;
  if (!key) throw new Error("Configuration manquante : APP_ENCRYPTION_KEY ou NIR_ENCRYPTION_KEY");
  const buffer = Buffer.from(key, "hex");
  if (buffer.length !== 32) {
    throw new Error("La cle de chiffrement doit etre une cle hexadecimale de 32 octets.");
  }
  return buffer;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(`${PREFIX}:`)) return value;

  const [, ivText, authTagText, encryptedText] = value.split(":");
  if (!ivText || !authTagText || !encryptedText) {
    throw new Error("Secret chiffre invalide.");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagText, "base64url"));
  return decipher.update(Buffer.from(encryptedText, "base64url"), undefined, "utf8") + decipher.final("utf8");
}
