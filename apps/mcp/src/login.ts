import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { DEFAULT_API_URL, loadSession, saveSession } from "./session.js";

/**
 * Login interactivo: la contrasena se escribe en la terminal (oculta), se usa
 * una sola vez contra la API y NO se guarda. Solo se persiste el refresh token
 * ("mantener sesion iniciada", 90 dias).
 */

let muted = false;
const output = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const ask = (q: string, hidden = false) =>
  new Promise<string>((resolve) => {
    process.stdout.write(q);
    muted = hidden;
    rl.question("", (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });

const previous = loadSession();
const apiUrl = (process.env.QA_METRICS_API_URL ?? previous?.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
console.log(`API: ${apiUrl}`);
const emailDefault = previous?.email ?? "";
const email = (await ask(`Email${emailDefault ? ` [${emailDefault}]` : ""}: `)) || emailDefault;
const password = await ask("Contrasena: ", true);
rl.close();

const res = await fetch(`${apiUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, rememberMe: true }),
});
const data = (await res.json().catch(() => ({}))) as {
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { name: string; role: { name: string } };
};
if (!res.ok || !data.refreshToken) {
  console.error(`Login fallido (${res.status}): ${data.error ?? "respuesta inesperada"}`);
  process.exit(1);
}

saveSession({ apiUrl, email, refreshToken: data.refreshToken, accessToken: data.accessToken });
console.log(`OK. Sesion guardada para ${data.user?.name} (${data.user?.role.name}).`);
