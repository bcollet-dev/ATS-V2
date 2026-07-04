import { describe, expect, it, beforeEach } from "vitest";
import { decryptSecret, encryptSecret } from "./secret-box";

describe("secret-box", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
  });

  it("encrypts and decrypts a secret", () => {
    const encrypted = encryptSecret("refresh-token");

    expect(encrypted).not.toBe("refresh-token");
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("refresh-token");
  });

  it("keeps legacy plaintext values readable", () => {
    expect(decryptSecret("legacy-refresh-token")).toBe("legacy-refresh-token");
  });
});
