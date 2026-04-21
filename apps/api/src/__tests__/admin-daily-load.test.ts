import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("GET /api/admin/daily-load — auth", () => {
  let adminToken: string;
  let leadToken: string;
  let analystToken: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    leadToken = await loginAs("laura.gomez@qametrics.com", "Lead2024!");
    analystToken = await loginAs("tester1@qametrics.com");
  });

  it("401 sin token", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load`);
    expect(r.status).toBe(401);
  });

  it("403 para QA_LEAD", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load`, {
      headers: { Authorization: `Bearer ${leadToken}` },
    });
    expect(r.status).toBe(403);
  });

  it("403 para QA_ANALYST", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(r.status).toBe(403);
  });

  it("200 para ADMIN", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("date");
    expect(body).toHaveProperty("isNonBusinessDay");
    expect(Array.isArray(body.rows)).toBe(true);
  });
});

describe("GET /api/admin/daily-load — día no laborable", () => {
  let adminToken: string;
  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
  });

  it("marca isNonBusinessDay=true en feriado (1ro de mayo 2026)", async () => {
    const date = "2026-05-01";
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=${date}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.date).toBe(date);
    expect(body.isNonBusinessDay).toBe(true);
  });

  it("marca isNonBusinessDay=true en sábado", async () => {
    // 2026-04-18 es sábado
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-18`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.isNonBusinessDay).toBe(true);
  });

  it("isNonBusinessDay=false en martes hábil (2026-04-21)", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-21`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.isNonBusinessDay).toBe(false);
  });

  it("400 si date tiene formato inválido", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=21-04-2026`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(400);
  });
});

describe("GET /api/admin/daily-load — rows", () => {
  let adminToken: string;
  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
  });

  it("incluye analistas con Tester vinculado y excluye al resto", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-21`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await r.json();
    expect(Array.isArray(body.rows)).toBe(true);

    // Seed incluye tester1@qametrics.com vinculado a Tester.
    const tester1 = body.rows.find((r: any) => r.userEmail === "tester1@qametrics.com");
    expect(tester1).toBeTruthy();
    expect(tester1).toMatchObject({
      userId: expect.any(String),
      userName: expect.any(String),
      userEmail: "tester1@qametrics.com",
      daily: expect.objectContaining({ loaded: expect.any(Boolean) }),
      activities: expect.objectContaining({ loaded: expect.any(Boolean) }),
    });

    // Admin NO debe aparecer (no es QA_ANALYST).
    const admin = body.rows.find((r: any) => r.userEmail === "admin@qametrics.com");
    expect(admin).toBeUndefined();

    // ana.garcia es QA_ANALYST pero NO está vinculada a Tester — no debe aparecer.
    const ana = body.rows.find((r: any) => r.userEmail === "ana.garcia@qametrics.com");
    expect(ana).toBeUndefined();
  });

  it("rows vienen ordenados asc por userName", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-21`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await r.json();
    const names = body.rows.map((r: any) => r.userName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "es"));
    expect(names).toEqual(sorted);
  });
});

describe("GET /api/admin/daily-load — DailyRecord", () => {
  let adminToken: string;
  let testerId: string;
  let assignmentId: string;
  let createdRecordId: string | null = null;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    const tester = await prisma.tester.findFirst({
      where: { user: { email: "tester1@qametrics.com" } },
      include: { assignments: { take: 1 } },
    });
    if (!tester || tester.assignments.length === 0) {
      throw new Error("seed necesita tester1 con al menos una assignment");
    }
    testerId = tester.id;
    assignmentId = tester.assignments[0]!.id;

    const rec = await prisma.dailyRecord.upsert({
      where: { assignmentId_date: { assignmentId, date: new Date(Date.UTC(2026, 3, 22)) } },
      update: { designed: 2, executed: 5, defects: 1 },
      create: {
        testerId, assignmentId,
        date: new Date(Date.UTC(2026, 3, 22)),
        designed: 2, executed: 5, defects: 1,
        source: "MANUAL",
      },
    });
    createdRecordId = rec.id;
  });

  afterAll(async () => {
    if (createdRecordId) {
      await prisma.dailyRecord.delete({ where: { id: createdRecordId } }).catch(() => {});
    }
  });

  it("tester1 aparece con daily.loaded=true y métricas agregadas", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-22`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await r.json();
    const row = body.rows.find((r: any) => r.userEmail === "tester1@qametrics.com");
    expect(row).toBeTruthy();
    expect(row.daily.loaded).toBe(true);
    expect(row.daily.storiesCount).toBe(1);
    expect(row.daily.designed).toBe(2);
    expect(row.daily.executed).toBe(5);
    expect(row.daily.defects).toBe(1);
    expect(row.daily.lastAt).not.toBeNull();
  });

  it("en otro día (sin registros) daily.loaded=false", async () => {
    const r = await fetch(`${API_URL}/api/admin/daily-load?date=2026-04-23`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await r.json();
    const row = body.rows.find((r: any) => r.userEmail === "tester1@qametrics.com");
    expect(row.daily.loaded).toBe(false);
    expect(row.daily.storiesCount).toBe(0);
  });
});
