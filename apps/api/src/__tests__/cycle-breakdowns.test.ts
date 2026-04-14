import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Cycle Breakdowns API", () => {
  let adminToken: string;
  let tester1Token: string;
  let cycleId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    tester1Token = await loginAs("tester1@qametrics.com");

    // Obtain a project and cycle via admin
    const me = await fetch(`${API_URL}/api/testers/me`, {
      headers: { Authorization: `Bearer ${tester1Token}` },
    });
    const meData = await me.json();
    const projectId = meData.projectId;

    const cyclesRes = await fetch(
      `${API_URL}/api/cycles?projectId=${projectId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const cycles = await cyclesRes.json();
    cycleId = cycles[0].id;
  });

  it("PUT admin on breakdown upserts", async () => {
    const res = await fetch(`${API_URL}/api/cycles/${cycleId}/breakdown`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ designedFunctional: 10 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.designedFunctional).toBe(10);
  });

  it("GET breakdown as admin returns values", async () => {
    const res = await fetch(`${API_URL}/api/cycles/${cycleId}/breakdown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.designedFunctional).toBe(10);
  });

  it("PUT as tester1 (analyst) is forbidden", async () => {
    const res = await fetch(`${API_URL}/api/cycles/${cycleId}/breakdown`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tester1Token}`,
      },
      body: JSON.stringify({ designedFunctional: 99 }),
    });
    expect(res.status).toBe(403);
  });
});
