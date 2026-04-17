import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("GET /api/reports/occupation", () => {
  let adminToken: string;
  let testerId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    const tester = await prisma.tester.findFirst({ where: { allocation: 100 } });
    if (!tester) throw new Error("seed needed: tester with allocation=100");
    testerId = tester.id;
  });

  it("requiere permiso reports:read (admin OK)", async () => {
    const r = await fetch(
      `${API_URL}/api/reports/occupation?testerIds=${testerId}&from=2026-06-01&to=2026-06-07`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({ testerId, workdays: expect.any(Number) });
  });

  it("sin testerIds y sin projectId devuelve 400", async () => {
    const r = await fetch(
      `${API_URL}/api/reports/occupation?from=2026-06-01&to=2026-06-07`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(r.status).toBe(400);
  });

  it("sin from/to devuelve 400", async () => {
    const r = await fetch(
      `${API_URL}/api/reports/occupation?testerIds=${testerId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(r.status).toBe(400);
  });
});
