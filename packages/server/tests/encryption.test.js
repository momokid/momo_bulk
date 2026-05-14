import { encrypt, decrypt } from "../src/utils/encryption.js";

describe("Encryption Utility", () => {
  const sampleText = "test-api-key-12345";

  test("encrypts a value and returns iv:encrypted format", () => {
    const result = encrypt(sampleText);
    expect(result).toContain(":");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // iv is 16 bytes = 32 hex chars
  });

  test("decrypts an encrypted value back to original", () => {
    const encrypted = encrypt(sampleText);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(sampleText);
  });

  test("encrypting the same value twice produces different results", () => {
    const first = encrypt(sampleText);
    const second = encrypt(sampleText);
    expect(first).not.toBe(second);
  });

  test("decrypts both different encryptions to the same original", () => {
    const first = encrypt(sampleText);
    const second = encrypt(sampleText);
    expect(decrypt(first)).toBe(sampleText);
    expect(decrypt(second)).toBe(sampleText);
  });
});
