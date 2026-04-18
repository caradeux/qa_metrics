import { describe, it, expect, beforeAll } from "vitest";
import { API_URL } from "./helpers/auth.js";

describe("POST /api/internal/run-daily-alerts", () => {
  beforeAll(() => {
    process.env.INTERNAL_SECRET = "dev-internal-secret-at-least-16-chars";
  });

  it("returns 403 without secret header", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts`, { method: "POST" });
    expect(r.status).toBe(403);
  });

  it("returns 403 with wrong secret", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts`, {
      method: "POST",
      headers: { "X-Internal-Secret": "wrong" },
    });
    expect(r.status).toBe(403);
  });

  it("returns 200 with correct secret and dryRun=true", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts?dryRun=true`, {
      method: "POST",
      headers: { "X-Internal-Secret": process.env.INTERNAL_SECRET! },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("dayChecked");
    expect(body).toHaveProperty("testersNotified");
    expect(body).toHaveProperty("assignmentsFlagged");
    expect(body).toHaveProperty("errors");
  });
});
