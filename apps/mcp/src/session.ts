import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * La sesion vive fuera del repo (en el home del usuario) para que el refresh
 * token nunca termine commiteado. Nunca se guarda la contrasena.
 */
export const SESSION_DIR = join(homedir(), ".qa-metrics-mcp");
const SESSION_FILE = join(SESSION_DIR, "session.json");

export const DEFAULT_API_URL = "https://api.qametrics.cl";

export interface Session {
  apiUrl: string;
  email: string;
  refreshToken: string;
  accessToken?: string;
}

export function apiUrl(): string {
  return (process.env.QA_METRICS_API_URL ?? loadSession()?.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
}

export function loadSession(): Session | null {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf8")) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(SESSION_FILE, 0o600);
  } catch {
    // En Windows chmod no aplica; el archivo queda bajo el perfil del usuario.
  }
}
