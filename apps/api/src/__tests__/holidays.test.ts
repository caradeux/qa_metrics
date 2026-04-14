import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Holidays API", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
  });

  it("GET /api/holidays?year=2026 requires auth", async () => {
    const res = await fetch(`${API_URL}/api/holidays?year=2026`);
    expect(res.status).toBe(401);
  });

  it("GET /api/holidays?year=2026 returns list with Dia del Trabajo", async () => {
    const res = await fetch(`${API_URL}/api/holidays?year=2026`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const names = data.map((h: { name: string }) => h.name.toLowerCase());
    expect(names.some((n: string) => n.includes("trabajo"))).toBe(true);
  });
});
