import { apiUrl, loadSession, saveSession, type Session } from "./session.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
}

function requireSession(): Session {
  const s = loadSession();
  if (!s) {
    throw new Error(
      "No hay sesion. Ejecuta en una terminal: npm run login -w @qa-metrics/mcp",
    );
  }
  return s;
}

/**
 * /api/auth/refresh devuelve el nuevo access token solo como cookie
 * (`qa_access`), asi que lo extraemos del Set-Cookie.
 */
async function refreshAccessToken(session: Session): Promise<string> {
  const res = await fetch(`${apiUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!res.ok) {
    throw new Error(
      "La sesion expiro o fue reemplazada (p. ej. iniciaste sesion en la web). " +
        "Ejecuta de nuevo: npm run login -w @qa-metrics/mcp",
    );
  }
  const cookies = res.headers.getSetCookie();
  const access = cookies
    .map((c) => /^qa_access=([^;]+)/.exec(c)?.[1])
    .find((v): v is string => !!v);
  if (!access) throw new Error("El refresh no devolvio access token");
  saveSession({ ...session, accessToken: access });
  return access;
}

export async function api<T = unknown>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const session = requireSession();
  const url = new URL(`${apiUrl()}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const send = (token: string) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let token = session.accessToken ?? (await refreshAccessToken(session));
  let res = await send(token);
  if (res.status === 401) {
    token = await refreshAccessToken(session);
    res = await send(token);
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // respuesta no JSON
  }
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed as T;
}
