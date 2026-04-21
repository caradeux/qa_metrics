import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

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
