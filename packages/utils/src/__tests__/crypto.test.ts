import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "../crypto.js";

describe("crypto", () => {
  beforeAll(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = "test-encryption-key-for-unit-tests-32ch";
  });

  it("encrypts and decrypts a string roundtrip", () => {
    const original = "Hello, World!";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(":");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const original = "Same text";
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);
    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  it("handles empty string", () => {
    const original = "";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("handles unicode characters", () => {
    const original = "Hola mundo! Prueba con acentos: cafe, nino, espanol";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("throws on invalid encrypted format", () => {
    expect(() => decrypt("invalid")).toThrow();
  });
});
