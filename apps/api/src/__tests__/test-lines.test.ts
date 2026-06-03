import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getAutoProjectId(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projects = await res.json();
  const auto = projects.find((p: any) => p.modality === "AUTOMATION");
  return auto.id;
}

describe("Test Lines API", () => {
  let adminToken: string;
  let projectId: string;
  let createdId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    projectId = await getAutoProjectId(adminToken);
  });

  it("GET /api/test-lines?projectId= returns the seeded test line", async () => {
    const res = await fetch(`${API_URL}/api/test-lines?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const lines = await res.json();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.some((l: any) => l.name === "Regresión Checkout")).toBe(true);
  });

  it("POST /api/test-lines creates a test line", async () => {
    const res = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId, name: "Smoke API Pagos", complexity: "MEDIUM" }),
    });
    expect(res.status).toBe(201);
    const line = await res.json();
    expect(line.name).toBe("Smoke API Pagos");
    expect(line.projectId).toBe(projectId);
    createdId = line.id;
  });

  it("PUT /api/test-lines/:id updates the name", async () => {
    const res = await fetch(`${API_URL}/api/test-lines/${createdId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Smoke API Pagos v2" }),
    });
    expect(res.status).toBe(200);
    const line = await res.json();
    expect(line.name).toBe("Smoke API Pagos v2");
  });

  it("DELETE /api/test-lines/:id removes it", async () => {
    const res = await fetch(`${API_URL}/api/test-lines/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("POST without name returns 400", async () => {
    const res = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId }),
    });
    expect(res.status).toBe(400);
  });
});
