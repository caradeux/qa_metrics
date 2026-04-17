import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("Activities API", () => {
  let adminToken: string;
  let analystToken: string;
  let testerId: string;
  let categoryId: string;
  let createdIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    analystToken = await loginAs("tester1@qametrics.com");
    const tester = await prisma.tester.findFirst({ where: { user: { email: "tester1@qametrics.com" } } });
    if (!tester) throw new Error("seed needed: tester1 must be linked to a Tester row");
    testerId = tester.id;
    const cat = await prisma.activityCategory.findFirst({ where: { name: "Capacitación" } });
    categoryId = cat!.id;
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.activity.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("POST: crea actividad válida", async () => {
    const r = await fetch(`${API_URL}/api/activities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        testerId, categoryId,
        startAt: "2026-06-01T09:00:00.000Z",
        endAt:   "2026-06-01T11:00:00.000Z",
        notes: "capacitación cypress",
      }),
    });
    expect(r.status).toBe(201);
    const data = await r.json();
    createdIds.push(data.id);
    expect(data.testerId).toBe(testerId);
  });

  it("POST: rechaza solape con otra actividad del mismo tester (409)", async () => {
    const r = await fetch(`${API_URL}/api/activities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        testerId, categoryId,
        startAt: "2026-06-01T10:00:00.000Z",
        endAt:   "2026-06-01T12:00:00.000Z",
      }),
    });
    expect(r.status).toBe(409);
  });

  it("POST: rechaza si startAt >= endAt (400)", async () => {
    const r = await fetch(`${API_URL}/api/activities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        testerId, categoryId,
        startAt: "2026-06-02T10:00:00.000Z",
        endAt:   "2026-06-02T09:00:00.000Z",
      }),
    });
    expect(r.status).toBe(400);
  });

  it("GET: QA_ANALYST (tester1) ve sus actividades", async () => {
    const r = await fetch(`${API_URL}/api/activities?testerId=${testerId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("POST: QA_ANALYST NO puede crear actividad para otro tester (403)", async () => {
    const otherTester = await prisma.tester.findFirst({
      where: { user: { email: "tester2@qametrics.com" } },
    });
    if (!otherTester) throw new Error("seed needed: tester2");
    const r = await fetch(`${API_URL}/api/activities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${analystToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        testerId: otherTester.id, categoryId,
        startAt: "2026-06-03T10:00:00.000Z",
        endAt:   "2026-06-03T11:00:00.000Z",
      }),
    });
    expect(r.status).toBe(403);
  });

  it("DELETE: admin borra su creación", async () => {
    const id = createdIds[0];
    const r = await fetch(`${API_URL}/api/activities/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(204);
    createdIds = createdIds.filter((x) => x !== id);
  });
});
