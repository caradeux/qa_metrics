import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowpilotClient } from "../lib/flowpilot/client.js";

function res(body: string, init: { status?: number; setCookie?: string } = {}) {
  const headers = new Headers();
  if (init.setCookie) headers.set("set-cookie", init.setCookie);
  return new Response(body, { status: init.status ?? 200, headers });
}

describe("FlowpilotClient.login", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("hace GET login (extrae csrf+cookie) y POST login, devuelve cookie autenticada", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        res('<input name="csrf_token" value="TOK">', { setCookie: "session=initcookie; Path=/" })
      )
      .mockResolvedValueOnce(
        res("", { status: 302, setCookie: "session=authcookie; Path=/; HttpOnly" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    const session = await client.login("a@b.cl", "secret");

    expect(session.cookie).toBe("session=authcookie");
    const [, postInit] = fetchMock.mock.calls[1];
    expect(postInit.method).toBe("POST");
    expect(String(postInit.body)).toContain("csrf_token=TOK");
    expect(String(postInit.body)).toContain("submit=");
  });

  it("elige la cookie 'session' aunque venga después de otras Set-Cookie", async () => {
    const multiHeaders = new Headers();
    multiHeaders.append("set-cookie", "csrftoken=abc; Path=/");
    multiHeaders.append("set-cookie", "session=authcookie; Path=/; HttpOnly");
    const getRes = new Response('<input name="csrf_token" value="TOK">', {
      headers: new Headers({ "set-cookie": "session=init; Path=/" }),
    });
    const postRes = new Response("", { status: 302, headers: multiHeaders });
    const fetchMock = vi.fn().mockResolvedValueOnce(getRes).mockResolvedValueOnce(postRes);
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    const session = await client.login("a@b.cl", "secret");
    expect(session.cookie).toBe("session=authcookie");
  });

  it("lanza si el POST login no redirige (credenciales inválidas)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res('<input name="csrf_token" value="TOK">', { setCookie: "session=init" }))
      .mockResolvedValueOnce(res("Credenciales inválidas", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    await expect(client.login("a@b.cl", "bad")).rejects.toThrow(/login/i);
  });
});

describe("FlowpilotClient catálogos y entradas", () => {
  beforeEach(() => vi.restoreAllMocks());
  const session = { cookie: "session=authcookie" };

  it("listClientsByEntityType parsea {data:[{id,name}]}", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      res(JSON.stringify({ data: [{ id: 36, name: "UDD" }], success: true }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new FlowpilotClient("https://fp.test");
    const out = await client.listClientsByEntityType(session, "contract");
    expect(out).toEqual([{ id: 36, name: "UDD" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/clients-by-entity-type?entity_type=contract");
  });

  it("createEntry hace POST JSON y devuelve la entrada creada", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      res(JSON.stringify({
        data: { id: 35220, client_id: 36, client_name: "UDD", date: "2026-06-01",
                description: "X", hours_worked: 4, task_type_name: "QA" },
        success: true,
      }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new FlowpilotClient("https://fp.test");
    const entry = await client.createEntry(session, {
      entityType: "contract", clientId: 36, taskTypeId: 3, date: "2026-06-01",
      hoursWorked: 4, description: "X", contractId: 84, projectId: null,
    });
    expect(entry.id).toBe(35220);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      entity_type: "contract", client_id: "36", task_type_id: "3",
      contract_id: "84", project_id: null, hours_worked: 4, description: "X",
    });
    expect(init.headers["X-Requested-With"]).toBe("XMLHttpRequest");
  });

  it("createEntry lanza si status != 201", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      res(JSON.stringify({ success: false, message: "error" }), { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new FlowpilotClient("https://fp.test");
    await expect(client.createEntry(session, {
      entityType: "project", clientId: 18, taskTypeId: 20, date: "2026-06-01",
      hoursWorked: 8, description: "Vac", contractId: null, projectId: 54,
    })).rejects.toThrow();
  });

  it("deleteEntry hace DELETE al id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new FlowpilotClient("https://fp.test");
    await client.deleteEntry(session, 35220);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/time-entries/35220");
    expect(init.method).toBe("DELETE");
  });

  it("listTaskTypes parsea {task_types:[{id,name}]} desde /api/task_types", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      res(JSON.stringify({ task_types: [{ id: 3, name: "QA" }, { id: 20, name: "vacacion" }], success: true }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new FlowpilotClient("https://fp.test");
    const out = await client.listTaskTypes(session);
    expect(out).toEqual([{ id: 3, name: "QA" }, { id: 20, name: "vacacion" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/task_types");
  });
});
