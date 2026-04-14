import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getMe(token: string) {
  const res = await fetch(`${API_URL}/api/testers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: res.status === 200 ? await res.json() : null };
}

describe("Daily Records API", () => {
  let adminToken: string;
  let tester1Token: string;
  let tester2Token: string;
  let tester1Id: string;
  let tester2Id: string;
  let cycleId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    tester1Token = await loginAs("tester1@qametrics.com");
    tester2Token = await loginAs("tester2@qametrics.com");
    const me1 = await getMe(tester1Token);
    const me2 = await getMe(tester2Token);
    tester1Id = me1.data.id;
    tester2Id = me2.data.id;

    // Fetch a cycle for tester1's project
    const projectId = me1.data.projectId;
    const cyclesRes = await fetch(
      `${API_URL}/api/cycles?projectId=${projectId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const cycles = await cyclesRes.json();
    cycleId = cycles[0]?.id;

    // cleanup any previous daily records for both testers in the test week
    await fetch(`${API_URL}/api/daily-records/_noop`).catch(() => {}); // ensure route registered
  });

  it("GET /api/daily-records returns 5 weekday shape", async () => {
    const weekStart = "2026-04-06"; // Monday
    const res = await fetch(
      `${API_URL}/api/daily-records?testerId=${tester1Id}&weekStart=${weekStart}`,
      { headers: { Authorization: `Bearer ${tester1Token}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weekStart).toBe(weekStart);
    expect(data.days).toHaveLength(5);
    expect(data.days[0]).toHaveProperty("date");
    expect(data.days[0]).toHaveProperty("designed");
    expect(data.days[0]).toHaveProperty("isHoliday");
    expect(data.days[0]).toHaveProperty("isFuture");
  });

  it("POST /api/daily-records/bulk as tester1 on self succeeds", async () => {
    const res = await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tester1Token}`,
      },
      body: JSON.stringify({
        testerId: tester1Id,
        cycleId,
        days: [
          { date: "2026-04-06", designed: 3, executed: 1, defects: 0 },
          { date: "2026-04-07", designed: 2, executed: 2, defects: 1 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const check = await fetch(
      `${API_URL}/api/daily-records?testerId=${tester1Id}&weekStart=2026-04-06`,
      { headers: { Authorization: `Bearer ${tester1Token}` } }
    );
    const checkData = await check.json();
    expect(checkData.days[0].designed).toBe(3);
    expect(checkData.days[1].executed).toBe(2);
  });

  it("POST bulk with holiday date 2026-05-01 returns 400", async () => {
    const res = await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tester1Token}`,
      },
      body: JSON.stringify({
        testerId: tester1Id,
        cycleId,
        days: [{ date: "2026-05-01", designed: 1, executed: 0, defects: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST bulk with future date returns 400", async () => {
    const res = await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tester1Token}`,
      },
      body: JSON.stringify({
        testerId: tester1Id,
        cycleId,
        days: [{ date: "2099-01-05", designed: 1, executed: 0, defects: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("tester1 acting on tester2 is forbidden", async () => {
    const res = await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tester1Token}`,
      },
      body: JSON.stringify({
        testerId: tester2Id,
        cycleId,
        days: [{ date: "2026-04-06", designed: 1, executed: 0, defects: 0 }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it("admin can post on any tester", async () => {
    const res = await fetch(`${API_URL}/api/daily-records/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        testerId: tester2Id,
        cycleId,
        days: [{ date: "2026-04-06", designed: 5, executed: 5, defects: 0 }],
      }),
    });
    expect(res.status).toBe(200);
  });
});
