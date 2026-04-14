import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("GET /api/testers/me", () => {
  it("tester1 returns its profile", async () => {
    const token = await loginAs("tester1@qametrics.com");
    const res = await fetch(`${API_URL}/api/testers/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("projectId");
    expect(data).toHaveProperty("name");
  });

  it("admin (no tester) returns 404", async () => {
    const token = await loginAs("admin@qametrics.com");
    const res = await fetch(`${API_URL}/api/testers/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });
});
