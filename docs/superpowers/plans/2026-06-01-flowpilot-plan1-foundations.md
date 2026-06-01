# FlowPilot Integración — Plan 1: Fundaciones & Adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar lista la base para enviar horas a FlowPilot: modelo de datos, captura cifrada del password al login, y un `FlowpilotClient` que hace login Flask+CSRF y crea/borra entradas — con un spike que prueba server-to-server antes de construir.

**Architecture:** Adapter aislado (`apps/api/src/lib/flowpilot/client.ts`) único módulo que habla con la API real de FlowPilot (Flask, cookie de sesión). El password del analista se captura en claro en el handler de login de qa_metrics, se cifra con el util existente `@qa-metrics/utils`, y se guarda en `FlowpilotCredential`. Tablas nuevas vía migración Prisma.

**Tech Stack:** Node/Express + Prisma (PostgreSQL), TypeScript ESM, vitest, `@qa-metrics/utils` (AES-256-GCM), `node:fetch`/`undici`.

**Spec:** `docs/superpowers/specs/2026-06-01-flowpilot-integration-design.md`
**API real:** `docs/superpowers/specs/flowpilot-api-notes.md`

---

## File Structure

- `docs/superpowers/specs/flowpilot-api-notes.md` — actualizar con confirmaciones del spike (DELETE, task-types, user id, same-origin).
- `packages/database/prisma/schema.prisma` — modificar: 4 modelos + relaciones en `User`.
- `packages/database/prisma/migrations/<ts>_flowpilot_foundations/` — crear: migración.
- `apps/api/src/config/env.ts` — modificar: `FLOWPILOT_BASE_URL`.
- `apps/api/src/lib/flowpilot/client.ts` — crear: el adapter.
- `apps/api/src/lib/flowpilot/types.ts` — crear: tipos compartidos del adapter.
- `apps/api/src/services/flowpilot-credential.service.ts` — crear: captura/lectura de credencial.
- `apps/api/src/routes/auth.routes.ts` — modificar: capturar password al login.
- `apps/api/scripts/flowpilot-spike.ts` — crear (throwaway): prueba server-to-server.
- `apps/api/src/__tests__/flowpilot-client.test.ts` — crear: tests del adapter (fetch mockeado).
- `apps/api/src/__tests__/flowpilot-credential.test.ts` — crear: captura al login.

---

## Task 0: Spike server-to-server (de-risk antes de construir)

Prueba que desde Node podemos: login Flask+CSRF, crear entrada y borrarla en el ambiente QA. Confirma los pendientes de Fase 0 (DELETE endpoint, fuente de task-types, user id, y si el backend rechaza llamadas sin navegador).

**Files:**
- Create: `apps/api/scripts/flowpilot-spike.ts`

- [ ] **Step 1: Escribir el script de spike**

```ts
// apps/api/scripts/flowpilot-spike.ts
// Throwaway. Ejecutar:  FP_EMAIL=.. FP_PASS=.. npx tsx apps/api/scripts/flowpilot-spike.ts
// NO commitear credenciales. Usa el ambiente QA.
const BASE = "https://wap-asignacion-semanal-horas-qa.azurewebsites.net";

function getCookie(setCookie: string | null): string {
  // toma "session=...; Path=/; HttpOnly" → "session=..."
  return (setCookie ?? "").split(";")[0] ?? "";
}

async function main() {
  const email = process.env.FP_EMAIL!;
  const password = process.env.FP_PASS!;

  // 1) GET login → cookie inicial + csrf_token del HTML
  const g = await fetch(`${BASE}/auth/login`, { redirect: "manual" });
  let cookie = getCookie(g.headers.get("set-cookie"));
  const html = await g.text();
  const m = html.match(/name="csrf_token"[^>]*value="([^"]+)"/);
  const csrf = m?.[1];
  console.log("csrf token found:", !!csrf, "cookie:", cookie.slice(0, 20));

  // 2) POST login (form-urlencoded)
  const form = new URLSearchParams({
    csrf_token: csrf ?? "",
    email, password, submit: "Iniciar Sesión",
  });
  const p = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body: form.toString(),
    redirect: "manual",
  });
  cookie = getCookie(p.headers.get("set-cookie")) || cookie;
  console.log("login status:", p.status, "(esperado 302)");

  // 3) Crear una entrada de prueba (cliente Interno/Vacaciones para no ensuciar QA real)
  const create = await fetch(`${BASE}/api/time-entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      cookie,
    },
    body: JSON.stringify({
      entity_type: "project", client_id: "18", task_type_id: "20",
      date: "2026-06-01", hours_worked: 0.5, time_start: null, time_end: null,
      description: "SPIKE qa_metrics — borrar", project_id: "54", contract_id: null,
      azure_work_item_id: null, workitem_name: null, story_task_id: null,
      bug_id: null, test_case_id: null,
    }),
  });
  const created = await create.json();
  console.log("create status:", create.status, "id:", created?.data?.id);

  // 4) Probar DELETE del id creado (CONFIRMAR endpoint)
  const id = created?.data?.id;
  if (id) {
    const del = await fetch(`${BASE}/api/time-entries/${id}`, {
      method: "DELETE",
      headers: { "X-Requested-With": "XMLHttpRequest", cookie },
    });
    console.log("delete status:", del.status, await del.text());
  }

  // 5) Buscar fuente de task-types y user id
  const dash = await fetch(`${BASE}/api/dashboard-summary`, {
    headers: { "X-Requested-With": "XMLHttpRequest", cookie },
  });
  console.log("dashboard-summary:", await dash.text());
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Ejecutar el spike contra QA**

Run (PowerShell):
```powershell
$env:FP_EMAIL="<email>"; $env:FP_PASS="<pass>"; npx tsx apps/api/scripts/flowpilot-spike.ts
```
Expected: `login status: 302`, `create status: 201` con un `id`, y un `delete status` (200/204 si DELETE existe; 404/405 si no).

- [ ] **Step 3: Registrar hallazgos en las notas de API**

Actualizar `docs/superpowers/specs/flowpilot-api-notes.md` con: ¿DELETE funciona y qué status? ¿server-to-server funcionó sin navegador (no rechazó por Origin)? ¿el user id propio aparece en `dashboard-summary`? ¿se ve el catálogo de task-types en algún lado? Si DELETE no existe, anotar el fallback (bloquear reenvío) para el Plan 3.

- [ ] **Step 4: Commit (script + notas)**

```bash
git add apps/api/scripts/flowpilot-spike.ts docs/superpowers/specs/flowpilot-api-notes.md
git commit -m "chore(flowpilot): spike server-to-server + confirmaciones de API"
```

> Si el spike revela que server-to-server es rechazado por el backend Flask
> (p.ej. valida Origin/Referer estricto), **detener y replantear** el modelo de
> envío (proxy desde el navegador del analista) antes de seguir. Es el riesgo que
> este task existe para descubrir.

---

## Task 1: Modelo de datos + migración

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_flowpilot_foundations/migration.sql` (generada por Prisma)

- [ ] **Step 1: Agregar los 4 modelos al schema**

En `packages/database/prisma/schema.prisma`, agregar al final:

```prisma
model FlowpilotCredential {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation("UserFlowpilotCredential", fields: [userId], references: [id], onDelete: Cascade)
  passwordEnc String
  capturedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model FlowpilotConnection {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation("UserFlowpilotConnection", fields: [userId], references: [id], onDelete: Cascade)
  flowpilotUserId Int?
  enabled         Boolean   @default(true)
  valid           Boolean   @default(false)
  lastValidatedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model FlowpilotMapping {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation("UserFlowpilotMappings", fields: [userId], references: [id], onDelete: Cascade)
  kind         String
  entityType   String
  clientId     Int
  clientName   String
  contractId   Int?
  projectId    Int?
  entityName   String
  taskTypeId   Int
  taskTypeName String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([userId, kind])
  @@index([userId])
}

model FlowpilotSyncLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("UserFlowpilotSyncLogs", fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  entryIds    Int[]
  hoursTotal  Float
  status      String
  payloadHash String
  sentAt      DateTime @default(now())

  @@unique([userId, date])
  @@index([userId])
}
```

- [ ] **Step 2: Agregar las relaciones inversas en el modelo `User`**

Buscar `model User {` en el mismo schema y agregar dentro:

```prisma
  flowpilotCredential FlowpilotCredential? @relation("UserFlowpilotCredential")
  flowpilotConnection FlowpilotConnection? @relation("UserFlowpilotConnection")
  flowpilotMappings   FlowpilotMapping[]   @relation("UserFlowpilotMappings")
  flowpilotSyncLogs   FlowpilotSyncLog[]   @relation("UserFlowpilotSyncLogs")
```

- [ ] **Step 3: Crear la migración**

Run (desde `packages/database`):
```bash
npx prisma migrate dev --name flowpilot_foundations
```
Expected: crea la carpeta de migración y aplica a la DB local; `prisma generate` corre solo. Sin errores.

- [ ] **Step 4: Verificar que el cliente Prisma compila los nuevos modelos**

Run (desde `packages/database`):
```bash
npx prisma validate
```
Expected: "The schema at prisma/schema.prisma is valid 🚀"

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): modelos FlowPilot (credential, connection, mapping, sync log)"
```

---

## Task 2: Config de entorno

**Files:**
- Modify: `apps/api/src/config/env.ts`

- [ ] **Step 1: Agregar `FLOWPILOT_BASE_URL` al schema de env**

En `apps/api/src/config/env.ts`, dentro de `envSchema`, agregar:

```ts
  FLOWPILOT_BASE_URL: z
    .string()
    .url()
    .default("https://wap-asignacion-semanal-horas-qa.azurewebsites.net"),
```

- [ ] **Step 2: Verificar typecheck**

Run (desde `apps/api`):
```bash
npx tsc --noEmit
```
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/config/env.ts
git commit -m "feat(api): FLOWPILOT_BASE_URL en config de entorno"
```

---

## Task 3: Tipos del adapter

**Files:**
- Create: `apps/api/src/lib/flowpilot/types.ts`

- [ ] **Step 1: Definir los tipos compartidos**

```ts
// apps/api/src/lib/flowpilot/types.ts
export interface FlowpilotCatalogItem {
  id: number;
  name: string;
}

export type FlowpilotEntityType = "contract" | "project";

export interface FlowpilotEntryInput {
  entityType: FlowpilotEntityType;
  clientId: number;
  taskTypeId: number;
  date: string;          // YYYY-MM-DD
  hoursWorked: number;
  description: string;
  contractId?: number | null;
  projectId?: number | null;
}

export interface FlowpilotEntry {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  description: string;
  hoursWorked: number;
  taskTypeName: string;
}

export interface FlowpilotSession {
  cookie: string;        // "session=..."
}
```

- [ ] **Step 2: Verificar typecheck**

Run (desde `apps/api`): `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/flowpilot/types.ts
git commit -m "feat(flowpilot): tipos del adapter"
```

---

## Task 4: FlowpilotClient — login Flask+CSRF

**Files:**
- Create: `apps/api/src/lib/flowpilot/client.ts`
- Test: `apps/api/src/__tests__/flowpilot-client.test.ts`

- [ ] **Step 1: Escribir el test de `login()` con fetch mockeado**

```ts
// apps/api/src/__tests__/flowpilot-client.test.ts
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
      // GET /auth/login
      .mockResolvedValueOnce(
        res('<input name="csrf_token" value="TOK">', { setCookie: "session=initcookie; Path=/" })
      )
      // POST /auth/login
      .mockResolvedValueOnce(
        res("", { status: 302, setCookie: "session=authcookie; Path=/; HttpOnly" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    const session = await client.login("a@b.cl", "secret");

    expect(session.cookie).toBe("session=authcookie");
    // segundo call = POST con form-urlencoded incluyendo csrf y submit
    const [, postInit] = fetchMock.mock.calls[1];
    expect(postInit.method).toBe("POST");
    expect(String(postInit.body)).toContain("csrf_token=TOK");
    expect(String(postInit.body)).toContain("submit=");
  });

  it("lanza si el POST login no redirige (credenciales inválidas)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res('<input name="csrf_token" value="TOK">', { setCookie: "session=init" }))
      .mockResolvedValueOnce(res("Credenciales inválidas", { status: 200 })); // sin 302
    vi.stubGlobal("fetch", fetchMock);

    const client = new FlowpilotClient("https://fp.test");
    await expect(client.login("a@b.cl", "bad")).rejects.toThrow(/login/i);
  });
});
```

- [ ] **Step 2: Correr el test → debe fallar (módulo no existe)**

Run (desde `apps/api`):
```bash
npx vitest run src/__tests__/flowpilot-client.test.ts
```
Expected: FAIL — "Cannot find module '../lib/flowpilot/client.js'".

- [ ] **Step 3: Implementar `FlowpilotClient.login()`**

```ts
// apps/api/src/lib/flowpilot/client.ts
import type {
  FlowpilotSession, FlowpilotCatalogItem, FlowpilotEntityType,
  FlowpilotEntryInput, FlowpilotEntry,
} from "./types.js";

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
```

- [ ] **Step 4: Correr el test → debe pasar**

Run: `npx vitest run src/__tests__/flowpilot-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/flowpilot/client.ts apps/api/src/__tests__/flowpilot-client.test.ts
git commit -m "feat(flowpilot): adapter login Flask+CSRF"
```

---

## Task 5: FlowpilotClient — catálogos, crear y borrar entradas

**Files:**
- Modify: `apps/api/src/lib/flowpilot/client.ts`
- Test: `apps/api/src/__tests__/flowpilot-client.test.ts`

> NOTA: confirmar con el spike (Task 0) el método/URL de DELETE y el endpoint de
> task-types antes de implementar. Si DELETE difiere, ajustar `deleteEntry`.

- [ ] **Step 1: Agregar tests de catálogos + createEntry + deleteEntry**

Añadir a `flowpilot-client.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Correr → deben fallar (métodos no existen)**

Run: `npx vitest run src/__tests__/flowpilot-client.test.ts`
Expected: FAIL — métodos `listClientsByEntityType`/`createEntry`/`deleteEntry` no existen.

- [ ] **Step 3: Implementar los métodos en `FlowpilotClient`**

Agregar dentro de la clase `FlowpilotClient`:

```ts
  private headers(session: FlowpilotSession, json = false): Record<string, string> {
    return {
      "X-Requested-With": "XMLHttpRequest",
      cookie: session.cookie,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  private async getCatalog(session: FlowpilotSession, path: string): Promise<FlowpilotCatalogItem[]> {
    const r = await fetch(`${this.baseUrl}${path}`, { headers: this.headers(session) });
    if (!r.ok) throw new Error(`FlowPilot catálogo ${path} → ${r.status}`);
    const json = (await r.json()) as { data?: FlowpilotCatalogItem[] };
    return json.data ?? [];
  }

  listClientsByEntityType(session: FlowpilotSession, entityType: FlowpilotEntityType) {
    return this.getCatalog(session, `/api/clients-by-entity-type?entity_type=${entityType}`);
  }
  listContractsByClient(session: FlowpilotSession, clientId: number) {
    return this.getCatalog(session, `/api/contracts/by-client/${clientId}`);
  }
  listProjectsByClient(session: FlowpilotSession, clientId: number) {
    return this.getCatalog(session, `/api/projects/by-client/${clientId}`);
  }

  async createEntry(session: FlowpilotSession, input: FlowpilotEntryInput): Promise<FlowpilotEntry> {
    const body = {
      entity_type: input.entityType,
      client_id: String(input.clientId),
      task_type_id: String(input.taskTypeId),
      date: input.date,
      hours_worked: input.hoursWorked,
      time_start: null, time_end: null,
      description: input.description,
      azure_work_item_id: null, workitem_name: null, story_task_id: null,
      bug_id: null, test_case_id: null,
      contract_id: input.contractId != null ? String(input.contractId) : null,
      project_id: input.projectId != null ? String(input.projectId) : null,
    };
    const r = await fetch(`${this.baseUrl}/api/time-entries`, {
      method: "POST", headers: this.headers(session, true), body: JSON.stringify(body),
    });
    if (r.status !== 201) {
      const txt = await r.text();
      throw new Error(`FlowPilot createEntry → ${r.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await r.json()) as { data: any };
    const d = json.data;
    return {
      id: d.id, clientId: d.client_id, clientName: d.client_name, date: d.date,
      description: d.description, hoursWorked: d.hours_worked, taskTypeName: d.task_type_name,
    };
  }

  async deleteEntry(session: FlowpilotSession, entryId: number): Promise<void> {
    const r = await fetch(`${this.baseUrl}/api/time-entries/${entryId}`, {
      method: "DELETE", headers: this.headers(session),
    });
    if (!r.ok) throw new Error(`FlowPilot deleteEntry ${entryId} → ${r.status}`);
  }
```

- [ ] **Step 4: Correr → deben pasar todos**

Run: `npx vitest run src/__tests__/flowpilot-client.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/flowpilot/client.ts apps/api/src/__tests__/flowpilot-client.test.ts
git commit -m "feat(flowpilot): catálogos, createEntry y deleteEntry en el adapter"
```

---

## Task 6: Servicio de credencial (cifrar/leer password)

**Files:**
- Create: `apps/api/src/services/flowpilot-credential.service.ts`
- Test: `apps/api/src/__tests__/flowpilot-credential.test.ts` (unit, sin red)

- [ ] **Step 1: Escribir el test de round-trip**

```ts
// apps/api/src/__tests__/flowpilot-credential.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { encryptPassword, decryptPassword } from "../services/flowpilot-credential.service.js";

beforeAll(() => { process.env.ENCRYPTION_KEY ??= "test-encryption-key-1234567890"; });

describe("flowpilot credential cifrado", () => {
  it("encrypt/decrypt es round-trip", () => {
    const enc = encryptPassword("Inovabiz.2025");
    expect(enc).not.toContain("Inovabiz.2025");
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptPassword(enc)).toBe("Inovabiz.2025");
  });
});
```

- [ ] **Step 2: Correr → falla (módulo no existe)**

Run (desde `apps/api`): `npx vitest run src/__tests__/flowpilot-credential.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar el servicio (reusa `@qa-metrics/utils`)**

```ts
// apps/api/src/services/flowpilot-credential.service.ts
import { encrypt, decrypt } from "@qa-metrics/utils";
import { prisma } from "@qa-metrics/database";

export function encryptPassword(plain: string): string {
  return encrypt(plain);
}
export function decryptPassword(enc: string): string {
  return decrypt(enc);
}

// Roles que cargan horas en FlowPilot (capturan credencial al login).
const HOUR_LOGGING_ROLES = new Set(["QA_ANALYST"]);

export async function captureCredentialOnLogin(
  userId: string, roleName: string, plainPassword: string,
): Promise<void> {
  if (!HOUR_LOGGING_ROLES.has(roleName)) return;
  const passwordEnc = encrypt(plainPassword);
  await prisma.flowpilotCredential.upsert({
    where: { userId },
    create: { userId, passwordEnc },
    update: { passwordEnc },
  });
}

export async function getDecryptedPassword(userId: string): Promise<string | null> {
  const cred = await prisma.flowpilotCredential.findUnique({ where: { userId } });
  return cred ? decrypt(cred.passwordEnc) : null;
}
```

- [ ] **Step 4: Correr → pasa**

Run: `npx vitest run src/__tests__/flowpilot-credential.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/flowpilot-credential.service.ts apps/api/src/__tests__/flowpilot-credential.test.ts
git commit -m "feat(flowpilot): servicio de credencial (cifrado round-trip)"
```

---

## Task 7: Capturar el password al iniciar sesión

**Files:**
- Modify: `apps/api/src/routes/auth.routes.ts`
- Test: `apps/api/src/__tests__/flowpilot-credential.test.ts` (agregar caso de integración)

- [ ] **Step 1: Agregar test de integración (login de analista crea credencial)**

Añadir a `flowpilot-credential.test.ts` (estilo integración como `activities.test.ts`):

```ts
import { API_URL } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("captura de credencial al login (integración)", () => {
  it("login de QA_ANALYST crea/actualiza FlowpilotCredential", async () => {
    const email = "tester1@qametrics.com";
    const r = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "QaMetrics2024!" }),
    });
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email } });
    const cred = await prisma.flowpilotCredential.findUnique({ where: { userId: user!.id } });
    expect(cred).not.toBeNull();
  });
});
```

> Nota: ajustar el password de seed real si difiere. `tester1@qametrics.com` debe
> tener rol QA_ANALYST en el seed (ya lo usa `activities.test.ts`).

- [ ] **Step 2: Correr → falla (credencial no se crea aún)**

Run: `npx vitest run src/__tests__/flowpilot-credential.test.ts -t "integración"`
Expected: FAIL — `cred` es null (el login todavía no captura).

- [ ] **Step 3: Modificar el handler de login para capturar**

En `apps/api/src/routes/auth.routes.ts`, importar el servicio y llamar tras el login exitoso:

```ts
import { captureCredentialOnLogin } from "../services/flowpilot-credential.service.js";
```

Dentro de `router.post("/login", ...)`, después de `const result = await authService.login(...)` y antes de `setAuthCookies`:

```ts
    // Capturar password cifrado para envío de horas a FlowPilot (best-effort,
    // no debe bloquear el login si falla).
    try {
      await captureCredentialOnLogin(result.user.id, result.user.role?.name ?? "", password);
    } catch (e) {
      // log y continuar
    }
```

> Verificar la forma real de `result.user.role` en `auth.service.ts` (puede ser
> `result.user.role.name`). Ajustar el acceso al nombre del rol según corresponda.

- [ ] **Step 4: Correr → pasa**

Run: `npx vitest run src/__tests__/flowpilot-credential.test.ts -t "integración"`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite de flowpilot**

Run: `npx vitest run src/__tests__/flowpilot-*.test.ts`
Expected: PASS todos.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/auth.routes.ts apps/api/src/__tests__/flowpilot-credential.test.ts
git commit -m "feat(flowpilot): capturar password cifrado al iniciar sesión (solo QA_ANALYST)"
```

---

## Self-Review (hecho)

- **Cobertura de spec (Plan 1):** modelo de datos ✓ (Task 1), captura de password al login ✓ (Task 6–7), adapter login+catálogos+crear+borrar ✓ (Task 4–5), reuso de cifrado existente ✓, de-risk server-to-server ✓ (Task 0). UI/preview/sync/homologación → Planes 2 y 3.
- **Sin placeholders:** todo paso con código real. Los "confirmar en spike" son tareas ejecutables, no TODOs.
- **Consistencia de tipos:** `FlowpilotSession.cookie`, `FlowpilotEntryInput` (camelCase) y el payload snake_case del POST son consistentes entre `types.ts`, `client.ts` y los tests.

---

## Roadmap — Planes siguientes (se escriben tras completar el Plan 1)

**Plan 2 — Homologación (admin):**
- Endpoints proxy de catálogo (`/api/flowpilot/catalog/*`) usando la sesión FlowPilot del admin.
- CRUD `FlowpilotMapping` (`GET/PUT/DELETE /api/flowpilot/mappings`), solo ADMIN/QA_LEAD.
- `GET/POST /api/flowpilot/connection(/test)` — estado + validación de conexión.
- UI: `apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx` (selector usuario + editor de filas con dropdowns en vivo) + ítem de sidebar.
- Tests: integración de catálogos (adapter mockeado) + CRUD de mappings.

**Plan 3 — Builder + Registro de Horas + Sync:**
- Day→Entries Builder (`apps/api/src/lib/flowpilot/day-entries.ts`): mapeo por `kind`, reparto de horas productivas (occupation.ts) con redondeo 0.5 y tope 8h. Tests unitarios exhaustivos (vacaciones, día lleno de reuniones, sin HU).
- `GET /api/flowpilot/preview?date=` y `POST /api/flowpilot/sync` con idempotencia (`FlowpilotSyncLog`, payloadHash, borrar+recrear o bloquear según hallazgo del spike sobre DELETE).
- UI: `apps/web/app/(app)/registro-horas/page.tsx` (navegador de fecha + preview editable + barra X/8h + botón Enviar bloqueado hasta conexión válida) + ítem de sidebar.
- Tests: builder (unit) + sync idempotente (integración con adapter mockeado).
```
