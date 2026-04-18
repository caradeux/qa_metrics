import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("ActivityCategories API", () => {
  let adminToken: string;
  let leadToken: string;
  let analystToken: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    leadToken = await loginAs("laura.gomez@qametrics.com", "Lead2024!");
    analystToken = await loginAs("ana.garcia@qametrics.com", "Analyst2024!");
  });

  it("GET /api/activity-categories requiere auth", async () => {
    const r = await fetch(`${API_URL}/api/activity-categories`);
    expect(r.status).toBe(401);
  });

  it("GET /api/activity-categories devuelve las 4 seed", async () => {
    const r = await fetch(`${API_URL}/api/activity-categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    const names = data.map((c: any) => c.name);
    expect(names).toEqual(expect.arrayContaining([
      "Reunión con usuario", "Reunión con desarrollo", "Capacitación", "Inducción",
    ]));
  });

  it("POST /api/activity-categories: QA_LEAD puede crear", async () => {
    const r = await fetch(`${API_URL}/api/activity-categories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${leadToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Daily standup " + Date.now(), color: "#888888" }),
    });
    expect(r.status).toBe(201);
  });

  it("POST /api/activity-categories: QA_ANALYST recibe 403", async () => {
    const r = await fetch(`${API_URL}/api/activity-categories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${analystToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Otro " + Date.now(), color: "#000000" }),
    });
    expect(r.status).toBe(403);
  });
});
