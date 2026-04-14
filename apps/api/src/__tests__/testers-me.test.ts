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

describe("GET /api/testers/:id authorization", () => {
  async function getMyTesterId(email: string): Promise<{ token: string; id: string }> {
    const token = await loginAs(email);
    const res = await fetch(`${API_URL}/api/testers/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return { token, id: data.id };
  }

  it("admin can GET any tester (200)", async () => {
    const { id: tester1Id } = await getMyTesterId("tester1@qametrics.com");
    const adminToken = await loginAs("admin@qametrics.com");
    const res = await fetch(`${API_URL}/api/testers/${tester1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id", tester1Id);
    expect(data).not.toHaveProperty("userId");
  });

  it("tester1 GET tester2 → 403", async () => {
    const { token: tester1Token } = await getMyTesterId("tester1@qametrics.com");
    const { id: tester2Id } = await getMyTesterId("tester2@qametrics.com");
    const res = await fetch(`${API_URL}/api/testers/${tester2Id}`, {
      headers: { Authorization: `Bearer ${tester1Token}` },
    });
    expect(res.status).toBe(403);
  });

  it("tester1 GET its own id → 200", async () => {
    const { token, id } = await getMyTesterId("tester1@qametrics.com");
    const res = await fetch(`${API_URL}/api/testers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id", id);
  });
});
