import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Client Reports API - monthly", () => {
  let adminToken: string;
  let analystToken: string;
  let clientId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    analystToken = await loginAs("tester1@qametrics.com");

    const res = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const clients = await res.json();
    clientId = clients[0]?.id;
  });

  it("GET /api/reports/client/:id/monthly as admin returns 200 with expected shape", async () => {
    const res = await fetch(
      `${API_URL}/api/reports/client/${clientId}/monthly`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.client.id).toBe(clientId);
    expect(Array.isArray(data.months)).toBe(true);
    expect(data.months).toHaveLength(6);
    expect(data.designedTotal.values).toHaveLength(6);
    expect(data.executedTotal.values).toHaveLength(6);
    expect(data.defectsTotal.values).toHaveLength(6);
    expect(Array.isArray(data.designedByProject)).toBe(true);
    expect(Array.isArray(data.analysts)).toBe(true);
  });

  it("GET as QA_ANALYST returns 403", async () => {
    const res = await fetch(
      `${API_URL}/api/reports/client/${clientId}/monthly`,
      { headers: { Authorization: `Bearer ${analystToken}` } }
    );
    expect(res.status).toBe(403);
  });

  it("GET with non-existent client returns 404", async () => {
    const res = await fetch(
      `${API_URL}/api/reports/client/cltnonexistent123/monthly`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.status).toBe(404);
  });
});
