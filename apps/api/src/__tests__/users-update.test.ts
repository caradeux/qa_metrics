import { describe, it, expect } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getUserByEmail(token: string, email: string) {
  const users = await (await fetch(`${API_URL}/api/users?role=QA_ANALYST`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  return users.find((u: any) => u.email === email);
}

describe("PUT /api/users/:id — especialidades y clientes", () => {
  it("guardar QA_AUTOMATION setea isAutomation=true", async () => {
    const token = await loginAs("admin@qametrics.com");
    const luis = await getUserByEmail(token, "luis.torres@qametrics.com");
    const res = await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ specialties: ["QA_AUTOMATION", "PERFORMANCE"] }),
    });
    expect(res.status).toBe(200);
    const updated = await getUserByEmail(token, "luis.torres@qametrics.com");
    expect(updated.specialties).toContain("QA_AUTOMATION");
    expect(updated.isAutomation).toBe(true);
  });

  it("clientIds reemplaza la asociación de clientes", async () => {
    const token = await loginAs("admin@qametrics.com");
    const clients = await (await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const targetClientId = clients[0].id;
    const luis = await getUserByEmail(token, "luis.torres@qametrics.com");
    const res = await fetch(`${API_URL}/api/users/${luis.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: [targetClientId] }),
    });
    expect(res.status).toBe(200);
    const updated = await getUserByEmail(token, "luis.torres@qametrics.com");
    expect(updated.assignedClients.map((c: any) => c.id)).toEqual([targetClientId]);
  });
});
