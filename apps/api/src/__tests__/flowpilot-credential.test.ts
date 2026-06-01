import { describe, it, expect, beforeAll } from "vitest";
import { encryptPassword, decryptPassword } from "../services/flowpilot-credential.service.js";
import { API_URL } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

beforeAll(() => { process.env.ENCRYPTION_KEY ??= "test-encryption-key-1234567890"; });

describe("flowpilot credential cifrado", () => {
  it("encrypt/decrypt es round-trip", () => {
    const enc = encryptPassword("Inovabiz.2025");
    expect(enc).not.toContain("Inovabiz.2025");
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptPassword(enc)).toBe("Inovabiz.2025");
  });
});

describe("captura de credencial al login (integración)", () => {
  it("login de QA_ANALYST crea/actualiza FlowpilotCredential", async () => {
    const email = "tester1@qametrics.com";
    const r = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "QaMetrics2024!" }),
    });
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email } });
    const cred = await prisma.flowpilotCredential.findUnique({ where: { userId: user!.id } });
    expect(cred).not.toBeNull();
  });
});
