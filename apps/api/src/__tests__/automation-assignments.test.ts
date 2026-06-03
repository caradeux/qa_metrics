import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Automation Assignments API", () => {
  let adminToken: string;
  let projectId: string;
  let testLineId: string;
  let testerId: string;
  let createdId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    const projectsRes = await fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const projects = await projectsRes.json();
    const auto = projects.find((p: any) => p.modality === "AUTOMATION");
    projectId = auto.id;
    testerId = auto.testers[0].id;

    const linesRes = await fetch(`${API_URL}/api/test-lines?projectId=${projectId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const lines = await linesRes.json();
    testLineId = lines.find((l: any) => l.name === "Regresión Checkout").id;
  });

  it("GET /api/automation-assignments?testLineId= lists assignments", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments?testLineId=${testLineId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it("POST creates an assignment for a tester that has none yet", async () => {
    const lineRes = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId, name: "Línea temporal asignación" }),
    });
    const freshLine = await lineRes.json();

    const res = await fetch(`${API_URL}/api/automation-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ testerId, testLineId: freshLine.id, startDate: "2026-05-04", status: "ACTIVE" }),
    });
    expect(res.status).toBe(201);
    const a = await res.json();
    expect(a.testerId).toBe(testerId);
    expect(a.status).toBe("ACTIVE");
    createdId = a.id;
  });

  it("PUT updates the status", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments/${createdId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "MAINTENANCE" }),
    });
    expect(res.status).toBe(200);
    const a = await res.json();
    expect(a.status).toBe("MAINTENANCE");
  });

  it("POST with invalid status returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ testerId, testLineId, startDate: "2026-05-04", status: "BOGUS" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET ?testerId of an out-of-scope project is forbidden for a scoped analyst (no IDOR)", async () => {
    // tester2@qametrics.com is a QA_ANALYST linked only to a manual project,
    // NOT to the automation project. It must NOT be able to read the automation
    // tester's assignments by passing ?testerId=.
    const analystToken = await loginAs("tester2@qametrics.com");
    const res = await fetch(`${API_URL}/api/automation-assignments?testerId=${testerId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(res.status).toBe(404);
  });
});
