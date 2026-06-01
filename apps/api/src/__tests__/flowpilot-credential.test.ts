import { describe, it, expect, beforeAll } from "vitest";
import { encryptPassword, decryptPassword } from "../services/flowpilot-credential.service.js";

beforeAll(() => { process.env.ENCRYPTION_KEY ??= "test-encryption-key-1234567890"; });

describe("flowpilot credential cifrado", () => {
  it("encrypt/decrypt es round-trip", () => {
    const enc = encryptPassword("Inovabiz.2025");
    expect(enc).not.toContain("Inovabiz.2025");
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptPassword(enc)).toBe("Inovabiz.2025");
  });
});
