import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("FlowPilot mappings CRUD", () => {
  let adminToken: string;
  let analystToken: string;
  let targetUserId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    analystToken = await loginAs("tester1@qametrics.com");
    const u = await prisma.user.findUnique({ where: { email: "tester1@qametrics.com" } });
    targetUserId = u!.id;
  });

  afterAll(async () => {
    await prisma.flowpilotMapping.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.flowpilotMapping.deleteMany({ where: { userId: targetUserId, kind: { in: ["QA_WORK", "TMP_DEL", "BAD"] } } });
  });

  it("PUT crea una homologación (admin)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "QA_WORK", entityType: "contract",
        clientId: 36, clientName: "UDD", contractId: 84,
        entityName: "1540_Célula QA - Renato García", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(r.status).toBe(200);
    const row = await r.json();
    createdIds.push(row.id);
    expect(row.kind).toBe("QA_WORK");
    expect(row.contractId).toBe(84);
  });

  it("PUT es idempotente por (userId,kind) — actualiza, no duplica", async () => {
    const body = {
      userId: targetUserId, kind: "QA_WORK", entityType: "contract",
      clientId: 36, clientName: "UDD", contractId: 82,
      entityName: "1541_Célula QA - Braulio Benardis", taskTypeId: 3, taskTypeName: "QA",
    };
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(r.status).toBe(200);
    const rows = await prisma.flowpilotMapping.findMany({ where: { userId: targetUserId, kind: "QA_WORK" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contractId).toBe(82);
  });

  it("PUT rechaza contract sin contractId (400)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "BAD", entityType: "contract",
        clientId: 36, clientName: "UDD", entityName: "x", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(r.status).toBe(400);
  });

  it("GET lista las homologaciones del usuario (admin)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings?userId=${targetUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const rows = await r.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((x: any) => x.kind === "QA_WORK")).toBe(true);
  });

  it("analista (no admin) recibe 403 en GET y PUT", async () => {
    const g = await fetch(`${API_URL}/api/flowpilot/mappings?userId=${targetUserId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(g.status).toBe(403);
    const p = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${analystToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "QA_WORK", entityType: "contract",
        clientId: 36, clientName: "UDD", contractId: 84, entityName: "x", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(p.status).toBe(403);
  });

  it("DELETE elimina la homologación (admin)", async () => {
    const created = await prisma.flowpilotMapping.create({
      data: {
        userId: targetUserId, kind: "TMP_DEL", entityType: "project",
        clientId: 18, clientName: "Interno", projectId: 54,
        entityName: "Vacaciones", taskTypeId: 20, taskTypeName: "vacacion",
      },
    });
    const r = await fetch(`${API_URL}/api/flowpilot/mappings/${created.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(204);
    const gone = await prisma.flowpilotMapping.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
