import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getUser(token: string, email: string) {
  const users = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  return users.find((u: any) => u.email === email);
}

describe("POST /api/testers — asociación estricta y sin tope de capacidad", () => {
  it("rechaza 400 si el analista no está asociado al cliente", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })).json();
    // cliente al que luis NO está asociado: tomar uno y asegurarse de desasociarlo
    const luis = await getUser(token, "luis.torres@qametrics.com");
    const targetClient = clients[0];
    await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [] }),
    });
    const projects = await (await fetch(`${API_URL}/api/projects?clientId=${targetClient.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const projectId = projects[0].id;
    const res = await fetch(`${API_URL}/api/testers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Luis Torres", projectId, userId: luis.id, allocation: 100 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asociado/i);
  });

  it("permite asignar aunque el analista ya esté al 100% (sin tope) si está asociado", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const targetClient = clients[0];
    const luis = await getUser(token, "luis.torres@qametrics.com");
    await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [targetClient.id] }),
    });
    const projects = await (await fetch(`${API_URL}/api/projects?clientId=${targetClient.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    // elegir un proyecto donde luis no sea aún tester
    const projectId = projects[projects.length - 1].id;
    const res = await fetch(`${API_URL}/api/testers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Luis Torres", projectId, userId: luis.id, allocation: 100 }),
    });
    // 201 creado, o 409 solo si "ya está asignado a este proyecto" (no por capacidad)
    if (res.status === 409) {
      const body = await res.json();
      expect(body.error).toMatch(/ya está asignado/i);
    } else {
      expect(res.status).toBe(201);
    }
  });
});
