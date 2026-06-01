import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("FlowPilot preview", () => {
  let token: string;
  let userId: string;
  let testerId: string;

  beforeAll(async () => {
    token = await loginAs("tester1@qametrics.com");
    const u = await prisma.user.findUnique({ where: { email: "tester1@qametrics.com" } });
    userId = u!.id;
    const t = await prisma.tester.findFirst({ where: { userId } });
    testerId = t!.id;
  });

  afterAll(async () => {
    await prisma.flowpilotMapping.deleteMany({ where: { userId, kind: "QA_WORK" } });
  });

  it("400 si falta date", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/preview`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(400);
  });

  it("devuelve preview del día con entradas e indicador de homologación", async () => {
    // Homologar QA_WORK para el usuario.
    await prisma.flowpilotMapping.upsert({
      where: { userId_kind: { userId, kind: "QA_WORK" } },
      create: {
        userId, kind: "QA_WORK", entityType: "contract", clientId: 36, clientName: "UDD",
        contractId: 84, projectId: null, entityName: "1540", taskTypeId: 3, taskTypeName: "QA",
      },
      update: {},
    });
    const r = await fetch(`${API_URL}/api/flowpilot/preview?date=2026-06-01`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("entries");
    expect(body).toHaveProperty("totalHours");
    expect(body).toHaveProperty("allMapped");
    expect(typeof body.capacityHours).toBe("number");
  });
});
