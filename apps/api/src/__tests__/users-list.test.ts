import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("GET /api/users — asociaciones y filtro por cliente", () => {
  it("incluye specialties y assignedClients", async () => {
    const token = await loginAs("admin@qametrics.com");
    const res = await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const users = await res.json();
    const ana = users.find((u: any) => u.email === "ana.garcia@qametrics.com");
    expect(ana).toBeTruthy();
    expect(Array.isArray(ana.specialties)).toBe(true);
    expect(ana.specialties).toContain("QA_MANUAL");
    expect(Array.isArray(ana.assignedClients)).toBe(true);
    expect(ana.assignedClients.length).toBeGreaterThan(0);
  });

  it("?clientId filtra solo analistas asociados a ese cliente", async () => {
    const token = await loginAs("admin@qametrics.com");
    const all = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const ana = all.find((u: any) => u.email === "ana.garcia@qametrics.com");
    const clientId = ana.assignedClients[0].id;
    const res = await fetch(`${API_URL}/api/users?role=QA_ANALYST&clientId=${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const filtered = await res.json();
    expect(filtered.every((u: any) => u.assignedClients.some((c: any) => c.id === clientId))).toBe(true);
    expect(filtered.find((u: any) => u.email === "ana.garcia@qametrics.com")).toBeTruthy();
  });
});
