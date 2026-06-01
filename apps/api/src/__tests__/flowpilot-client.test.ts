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

  it("lanza si el POST login no redirige (credenciales inválidas)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res('<input name="csrf_token" value="TOK">', { setCookie: "session=init" }))
      .mockResolvedValueOnce(res("Credenciales inválidas", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    await expect(client.login("a@b.cl", "bad")).rejects.toThrow(/login/i);
  });
});
