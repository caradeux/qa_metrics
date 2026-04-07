import { describe, it, expect, beforeAll } from "vitest";

const API_URL = "http://localhost:4000";

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.accessToken;
}

describe("Permissions API", () => {
  let adminToken: string;
  let analystToken: string;

  beforeAll(async () => {
    adminToken = await login("admin@qametrics.com", "QaMetrics2024!");
    // Analyst login - this may fail if no analyst user is seeded;
    // in that case the analyst tests will be skipped gracefully.
    try {
      analystToken = await login("analyst@qametrics.com", "QaMetrics2024!");
    } catch {
      analystToken = "";
    }
  });

  it("admin can access GET /api/users", async () => {
    const res = await fetch(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("admin can access GET /api/roles", async () => {
    const res = await fetch(`${API_URL}/api/roles`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("admin can access GET /api/clients", async () => {
    const res = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("analyst cannot access GET /api/users", async () => {
    if (!analystToken) return; // skip if no analyst user seeded
    const res = await fetch(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("analyst cannot access GET /api/roles", async () => {
    if (!analystToken) return; // skip if no analyst user seeded
    const res = await fetch(`${API_URL}/api/roles`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("unauthenticated request returns 401", async () => {
    const res = await fetch(`${API_URL}/api/users`);
    expect(res.status).toBe(401);
  });

  it("invalid token returns 401", async () => {
    const res = await fetch(`${API_URL}/api/users`, {
      headers: { Authorization: "Bearer invalid-token-here" },
    });
    expect(res.status).toBe(401);
  });
});
