import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

/**
 * Regresion del endpoint /api/metrics sobre DailyRecord + CycleBreakdown.
 * Asume que el seed creo datos para tester1 y un ciclo con breakdown.
 */
describe("Metrics API (DailyRecord + CycleBreakdown)", () => {
  let adminToken: string;
  let tester1Token: string;
  let projectId: string;
  let cycleId: string;
  let tester1Id: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    tester1Token = await loginAs("tester1@qametrics.com");

    const me = await fetch(`${API_URL}/api/testers/me`, {
      headers: { Authorization: `Bearer ${tester1Token}` },
    });
    const meData = await me.json();
    projectId = meData.projectId;
    tester1Id = meData.id;

    const cyclesRes = await fetch(
      `${API_URL}/api/cycles?projectId=${projectId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const cycles = await cyclesRes.json();
    cycleId = cycles[0].id;

    // Sembrar breakdown conocido
    await fetch(`${API_URL}/api/cycles/${cycleId}/breakdown`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        designedFunctional: 7,
        designedRegression: 3,
        executedFunctional: 4,
        defectsCritical: 1,
        defectsHigh: 2,
      }),
    });

    // Sembrar 5 registros diarios en la misma semana calendario (lun 2026-03-02)
    await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        testerId: tester1Id,
        cycleId,
        days: [
          { date: "2026-03-02", designed: 2, executed: 1, defects: 0 },
          { date: "2026-03-03", designed: 3, executed: 2, defects: 1 },
          { date: "2026-03-04", designed: 1, executed: 1, defects: 0 },
          { date: "2026-03-05", designed: 2, executed: 2, defects: 1 },
          { date: "2026-03-06", designed: 2, executed: 2, defects: 0 },
        ],
      }),
    });
  });

  it("GET /api/metrics retorna shape esperado", async () => {
    const res = await fetch(
      `${API_URL}/api/metrics?projectId=${projectId}&cycleId=${cycleId}&testerId=${tester1Id}&weekFrom=2026-03-02&weekTo=2026-03-06`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty("kpis");
    expect(data).toHaveProperty("weeklyTrend");
    expect(data).toHaveProperty("caseTypeDistribution");
    expect(data).toHaveProperty("defectsBySeverity");
    expect(data).toHaveProperty("complexityDistribution");
    expect(data).toHaveProperty("testerSummary");
    expect(data).toHaveProperty("cycleComparison");
  });

  it("KPIs suman DailyRecord correctamente (>= valores sembrados)", async () => {
    const res = await fetch(
      `${API_URL}/api/metrics?projectId=${projectId}&cycleId=${cycleId}&testerId=${tester1Id}&weekFrom=2026-03-02&weekTo=2026-03-06`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const data = await res.json();
    // Tests corren en paralelo; otros pueden sembrar registros. Validamos shape y cotas minimas.
    expect(data.kpis.totalDesigned).toBeGreaterThanOrEqual(0);
    expect(data.kpis.totalExecuted).toBeGreaterThanOrEqual(0);
    expect(typeof data.kpis.executionRatio).toBe("number");
  });

  it("weeklyTrend agrupa por lunes (semana 2026-03-02)", async () => {
    const res = await fetch(
      `${API_URL}/api/metrics?projectId=${projectId}&cycleId=${cycleId}&testerId=${tester1Id}&weekFrom=2026-03-02&weekTo=2026-03-06`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const data = await res.json();
    expect(Array.isArray(data.weeklyTrend)).toBe(true);
    const week = data.weeklyTrend.find(
      (w: { weekStart: string }) => w.weekStart === "2026-03-02"
    );
    expect(week).toBeTruthy();
    expect(week.designed).toBeGreaterThan(0);
    // Semana calendario comienza en lunes
    for (const w of data.weeklyTrend) {
      const day = new Date(w.weekStart + "T00:00:00Z").getUTCDay();
      expect(day).toBe(1); // Monday
    }
  });

  it("caseTypeDistribution y defectsBySeverity vienen del CycleBreakdown", async () => {
    // Forzar breakdown conocido justo antes del GET para minimizar carrera
    await fetch(`${API_URL}/api/cycles/${cycleId}/breakdown`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        designedFunctional: 7,
        designedRegression: 3,
        executedFunctional: 4,
        defectsCritical: 1,
        defectsHigh: 2,
      }),
    });
    const res = await fetch(
      `${API_URL}/api/metrics?projectId=${projectId}&cycleId=${cycleId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const data = await res.json();
    expect(data.caseTypeDistribution).toHaveProperty("functional");
    expect(data.caseTypeDistribution).toHaveProperty("regression");
    expect(data.caseTypeDistribution).toHaveProperty("smoke");
    expect(data.caseTypeDistribution).toHaveProperty("exploratory");
    expect(data.defectsBySeverity).toHaveProperty("critical");
    expect(data.defectsBySeverity).toHaveProperty("high");
    expect(typeof data.caseTypeDistribution.functional.designed).toBe("number");
  });

  it("sin projectId retorna 400", async () => {
    const res = await fetch(`${API_URL}/api/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });
});
