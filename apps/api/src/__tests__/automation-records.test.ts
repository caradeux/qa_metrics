import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Automation Records API", () => {
  let adminToken: string;
  let testerId: string;
  let assignmentId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");

    const projectsRes = await fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const projects = await projectsRes.json();
    const auto = projects.find((p: any) => p.modality === "AUTOMATION");
    testerId = auto.testers.find((t: any) => t.name === "Tester Uno").id;

    const aRes = await fetch(`${API_URL}/api/automation-assignments?testerId=${testerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await aRes.json();
    assignmentId = assignments[0].id;
  });

  it("GET /api/automation-records returns a 5-weekday shape", async () => {
    const weekStart = "2026-04-06";
    const res = await fetch(
      `${API_URL}/api/automation-records?testerId=${testerId}&weekStart=${weekStart}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weekStart).toBe(weekStart);
    expect(data.days).toHaveLength(5);
    expect(data.assignments.length).toBeGreaterThan(0);
  });

  it("POST /api/automation-records/bulk upserts counters", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [
          { assignmentId, date: "2026-04-06", scriptsCreated: 4, scriptsRefactored: 1, scriptsFixed: 0, execTotal: 12, execPassed: 11, execFailed: 1 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const check = await fetch(
      `${API_URL}/api/automation-records?testerId=${testerId}&weekStart=2026-04-06`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const checkData = await check.json();
    const a = checkData.assignments.find((x: any) => x.id === assignmentId);
    const rec = a.records.find((r: any) => r.date === "2026-04-06");
    expect(rec.scriptsCreated).toBe(4);
    expect(rec.execPassed).toBe(11);
  });

  it("POST bulk with a future date returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [{ assignmentId, date: "2099-01-05", scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST bulk on a holiday (2026-05-01) returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [{ assignmentId, date: "2026-05-01", scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });
});
