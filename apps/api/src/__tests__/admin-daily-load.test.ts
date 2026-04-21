import { describe, it, expect, beforeAll } from "vitest";
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
