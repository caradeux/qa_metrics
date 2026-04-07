import { describe, it, expect } from "vitest";

const API_URL = "http://localhost:4000";

describe("Auth API", () => {
  it("POST /api/auth/login - success", async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@qametrics.com", password: "QaMetrics2024!" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("accessToken");
    expect(data).toHaveProperty("refreshToken");
    expect(data.user).toHaveProperty("role");
    expect(data.user.role).toHaveProperty("permissions");
  });

  it("POST /api/auth/login - invalid password", async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@qametrics.com", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/clients - requires auth", async () => {
    const res = await fetch(`${API_URL}/api/clients`);
    expect(res.status).toBe(401);
  });

  it("GET /api/clients - with auth", async () => {
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@qametrics.com", password: "QaMetrics2024!" }),
    });
    const { accessToken } = await loginRes.json();

    const res = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
