import type { FlowpilotSession } from "./types.js";

function firstCookie(setCookie: string | null): string {
  return (setCookie ?? "").split(";")[0]?.trim() ?? "";
}

export class FlowpilotClient {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<FlowpilotSession> {
    const g = await fetch(`${this.baseUrl}/auth/login`, { redirect: "manual" });
    const initCookie = firstCookie(g.headers.get("set-cookie"));
    const html = await g.text();
    const csrf = html.match(/name="csrf_token"[^>]*value="([^"]+)"/)?.[1] ?? "";

    const form = new URLSearchParams({
      csrf_token: csrf, email, password, submit: "Iniciar Sesión",
    });
    const p = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: initCookie },
      body: form.toString(),
      redirect: "manual",
    });
    if (p.status !== 302) {
      throw new Error("FlowPilot login falló (credenciales inválidas o flujo cambiado)");
    }
    const authCookie = firstCookie(p.headers.get("set-cookie")) || initCookie;
    return { cookie: authCookie };
  }
}
