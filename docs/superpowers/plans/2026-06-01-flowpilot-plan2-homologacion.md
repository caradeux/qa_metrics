# FlowPilot Integración — Plan 2: Homologación (admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un ADMIN homologue, por usuario, dónde carga sus horas en FlowPilot (Tipo de Entidad → Cliente → Contrato/Proyecto → Tipo de Tarea), eligiendo desde catálogos en vivo de FlowPilot; persistir esas homologaciones en `FlowpilotMapping`.

**Architecture:** El servidor obtiene una sesión FlowPilot del propio usuario que pide (login programático con su credencial cifrada del Plan 1) y expone endpoints **proxy de catálogo**. Un router `flowpilot.routes.ts` agrega proxy de catálogo (ADMIN/QA_LEAD) + CRUD de `FlowpilotMapping`. El front tiene una página admin con selector de usuario y editor de filas con dropdowns en cascada alimentados por el proxy.

**Tech Stack:** Express + Prisma, vitest (integración contra API+DB), Next.js (app router, `apiClient`), TypeScript ESM.

**Depends on:** Plan 1 (FlowpilotClient, FlowpilotCredential, FlowpilotMapping, FlowpilotConnection ya existen y la migración está aplicada).
**Spec:** `docs/superpowers/specs/2026-06-01-flowpilot-integration-design.md` · **API:** `docs/superpowers/specs/flowpilot-api-notes.md`

---

## Confirmaciones de API usadas aquí
- Clientes: `GET /api/clients-by-entity-type?entity_type=contract|project` → `{data:[{id,name}]}`
- Contratos: `GET /api/contracts/by-client/{clientId}` → `{data:[{id,name}]}`
- Proyectos: `GET /api/projects/by-client/{clientId}` → `{data:[{id,name}]}`
- Tipos de tarea: `GET /api/task_types` (guion BAJO) → `{task_types:[{id,name}]}`

---

## File Structure
- `apps/api/src/lib/flowpilot/client.ts` — modificar: agregar `listTaskTypes`.
- `apps/api/src/services/flowpilot-credential.service.ts` — modificar: ampliar roles de captura.
- `apps/api/src/services/flowpilot-session.service.ts` — crear: `getSession(userId)` + singleton del client.
- `apps/api/src/validators/flowpilot.validator.ts` — crear: zod del upsert de mapping.
- `apps/api/src/routes/flowpilot.routes.ts` — crear: proxy de catálogo + CRUD de mappings.
- `apps/api/src/index.ts` — modificar: montar `/api/flowpilot`.
- `apps/api/src/__tests__/flowpilot-client.test.ts` — modificar: test de `listTaskTypes`.
- `apps/api/src/__tests__/flowpilot-mappings.test.ts` — crear: CRUD + authz (integración).
- `apps/web/lib/api-client.ts` — modificar: `flowpilotApi`.
- `apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx` — crear: UI.
- `apps/web/components/layout/Sidebar.tsx` — modificar: ítem de menú (Admin).

---

## Task 1: Adapter `listTaskTypes` + sesión por usuario + roles de captura

**Files:**
- Modify: `apps/api/src/lib/flowpilot/client.ts`, `apps/api/src/__tests__/flowpilot-client.test.ts`
- Modify: `apps/api/src/services/flowpilot-credential.service.ts`
- Create: `apps/api/src/services/flowpilot-session.service.ts`

- [ ] **Step 1: Test de `listTaskTypes` (TDD)**

Agregar a `flowpilot-client.test.ts`, dentro del `describe("FlowpilotClient catálogos y entradas", ...)`:

```ts
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
```

- [ ] **Step 2: Correr → falla** — `npx vitest run src/__tests__/flowpilot-client.test.ts` → FAIL (`listTaskTypes` no existe).

- [ ] **Step 3: Implementar `listTaskTypes`** en `client.ts` (dentro de la clase). Nota: el endpoint devuelve `task_types`, no `data`, así que no reusa `getCatalog`:

```ts
  async listTaskTypes(session: FlowpilotSession): Promise<FlowpilotCatalogItem[]> {
    const r = await fetch(`${this.baseUrl}/api/task_types`, { headers: this.headers(session) });
    if (!r.ok) throw new Error(`FlowPilot /api/task_types → ${r.status}`);
    const json = (await r.json()) as { task_types?: FlowpilotCatalogItem[] };
    return json.task_types ?? [];
  }
```

- [ ] **Step 4: Correr → pasa** (8 tests en el archivo).

- [ ] **Step 5: Ampliar roles de captura** en `flowpilot-credential.service.ts`: reemplazar
```ts
const HOUR_LOGGING_ROLES = new Set(["QA_ANALYST"]);
```
por
```ts
// Roles que cargan/gestionan horas en FlowPilot (capturan credencial al login).
// ADMIN/QA_LEAD la necesitan para usar el proxy de catálogos en la homologación.
const FLOWPILOT_CAPTURE_ROLES = new Set(["QA_ANALYST", "QA_LEAD", "ADMIN"]);
```
y actualizar la referencia en `captureCredentialOnLogin` (`if (!FLOWPILOT_CAPTURE_ROLES.has(roleName)) return;`).

- [ ] **Step 6: Crear `flowpilot-session.service.ts`** (seam de integración: login por usuario):

```ts
import { prisma } from "@qa-metrics/database";
import { env } from "../config/env.js";
import { FlowpilotClient } from "../lib/flowpilot/client.js";
import type { FlowpilotSession } from "../lib/flowpilot/types.js";
import { getDecryptedPassword } from "./flowpilot-credential.service.js";

export const flowpilotClient = new FlowpilotClient(env.FLOWPILOT_BASE_URL);

export class FlowpilotNoCredentialError extends Error {}

// Inicia sesión en FlowPilot en nombre del usuario, usando su credencial cifrada.
export async function getSession(userId: string): Promise<FlowpilotSession> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const password = await getDecryptedPassword(userId);
  if (!user || !password) {
    throw new FlowpilotNoCredentialError("El usuario no tiene credencial de FlowPilot. Inicia sesión en qa_metrics para capturarla.");
  }
  return flowpilotClient.login(user.email, password);
}
```

- [ ] **Step 7: Typecheck** — `npx tsc --noEmit` desde `apps/api` → sin errores en los archivos tocados.

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/lib/flowpilot/client.ts apps/api/src/__tests__/flowpilot-client.test.ts apps/api/src/services/flowpilot-credential.service.ts apps/api/src/services/flowpilot-session.service.ts
git commit -m "feat(flowpilot): listTaskTypes + sesión por usuario + captura para ADMIN/QA_LEAD"
```

---

## Task 2: Validador + router (proxy de catálogo + CRUD de mappings)

**Files:**
- Create: `apps/api/src/validators/flowpilot.validator.ts`
- Create: `apps/api/src/routes/flowpilot.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Crear el validador** `apps/api/src/validators/flowpilot.validator.ts`:

```ts
import { z } from "zod";

export const upsertMappingSchema = z.object({
  userId: z.string().cuid(),
  kind: z.string().min(1).max(40),
  entityType: z.enum(["contract", "project"]),
  clientId: z.number().int(),
  clientName: z.string().min(1),
  contractId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  entityName: z.string().min(1),
  taskTypeId: z.number().int(),
  taskTypeName: z.string().min(1),
}).refine(
  (d) => (d.entityType === "contract" ? d.contractId != null : d.projectId != null),
  { message: "contract requiere contractId; project requiere projectId" },
);
```

- [ ] **Step 2: Crear el router** `apps/api/src/routes/flowpilot.routes.ts`:

```ts
import { Router, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { getSession, flowpilotClient, FlowpilotNoCredentialError } from "../services/flowpilot-session.service.js";
import { upsertMappingSchema } from "../validators/flowpilot.validator.js";

const router = Router();
router.use(authMiddleware as any);

const ADMIN_ROLES = new Set(["ADMIN", "QA_LEAD"]);
function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!ADMIN_ROLES.has(req.user?.role?.name ?? "")) {
    res.status(403).json({ error: "Solo ADMIN/QA_LEAD" });
    return false;
  }
  return true;
}

// Helper: corre una operación con la sesión FlowPilot del usuario actual.
async function withCatalog<T>(req: AuthRequest, res: Response, fn: (session: any) => Promise<T>) {
  try {
    const session = await getSession(req.user!.id);
    res.json({ data: await fn(session) });
  } catch (e) {
    if (e instanceof FlowpilotNoCredentialError) {
      res.status(409).json({ error: e.message });
      return;
    }
    res.status(502).json({ error: "Error consultando FlowPilot", detail: (e as Error).message });
  }
}

// ───── Proxy de catálogos (ADMIN/QA_LEAD) ─────
router.get("/catalog/clients", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const entityType = req.query.entityType === "project" ? "project" : "contract";
  await withCatalog(req, res, (s) => flowpilotClient.listClientsByEntityType(s, entityType));
});

router.get("/catalog/contracts", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (s) => flowpilotClient.listContractsByClient(s, clientId));
});

router.get("/catalog/projects", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (s) => flowpilotClient.listProjectsByClient(s, clientId));
});

router.get("/catalog/task-types", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  await withCatalog(req, res, (s) => flowpilotClient.listTaskTypes(s));
});

// ───── CRUD de homologaciones (ADMIN/QA_LEAD) ─────
router.get("/mappings", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const userId = req.query.userId as string | undefined;
  if (!userId) { res.status(400).json({ error: "userId requerido" }); return; }
  const rows = await prisma.flowpilotMapping.findMany({ where: { userId }, orderBy: { kind: "asc" } });
  res.json(rows);
});

router.put("/mappings", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const d = upsertMappingSchema.parse(req.body);
    const row = await prisma.flowpilotMapping.upsert({
      where: { userId_kind: { userId: d.userId, kind: d.kind } },
      create: {
        userId: d.userId, kind: d.kind, entityType: d.entityType,
        clientId: d.clientId, clientName: d.clientName,
        contractId: d.contractId ?? null, projectId: d.projectId ?? null,
        entityName: d.entityName, taskTypeId: d.taskTypeId, taskTypeName: d.taskTypeName,
      },
      update: {
        entityType: d.entityType, clientId: d.clientId, clientName: d.clientName,
        contractId: d.contractId ?? null, projectId: d.projectId ?? null,
        entityName: d.entityName, taskTypeId: d.taskTypeId, taskTypeName: d.taskTypeName,
      },
    });
    res.json(row);
  } catch (e) {
    if (e instanceof ZodError) { res.status(400).json({ errors: e.errors }); return; }
    throw e;
  }
});

router.delete("/mappings/:id", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  await prisma.flowpilotMapping.deleteMany({ where: { id: req.params.id as string } });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 3: Montar el router** en `apps/api/src/index.ts`. Agregar import junto a los otros:
```ts
import flowpilotRoutes from "./routes/flowpilot.routes.js";
```
y la línea de montaje junto a las demás `app.use("/api/...")`:
```ts
app.use("/api/flowpilot", flowpilotRoutes);
```

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit` desde `apps/api` → sin errores en los nuevos archivos.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/validators/flowpilot.validator.ts apps/api/src/routes/flowpilot.routes.ts apps/api/src/index.ts
git commit -m "feat(flowpilot): router proxy de catálogos + CRUD de homologaciones"
```

---

## Task 3: Tests de mappings CRUD + authz (integración)

**Files:**
- Create: `apps/api/src/__tests__/flowpilot-mappings.test.ts`

> Estos tests son de integración (API viva + DB), como `activities.test.ts`. NO
> prueban el proxy de catálogos (eso llama a FlowPilot en vivo) — solo authz del
> CRUD y el ciclo completo de homologación sobre la DB. El helper `loginAs(email)`
> existe en `./helpers/auth.js`.

- [ ] **Step 1: Escribir el test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("FlowPilot mappings CRUD", () => {
  let adminToken: string;
  let analystToken: string;
  let targetUserId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    analystToken = await loginAs("tester1@qametrics.com");
    const u = await prisma.user.findUnique({ where: { email: "tester1@qametrics.com" } });
    targetUserId = u!.id;
  });

  afterAll(async () => {
    await prisma.flowpilotMapping.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("PUT crea una homologación (admin)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "QA_WORK", entityType: "contract",
        clientId: 36, clientName: "UDD", contractId: 84,
        entityName: "1540_Célula QA - Renato García", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(r.status).toBe(200);
    const row = await r.json();
    createdIds.push(row.id);
    expect(row.kind).toBe("QA_WORK");
    expect(row.contractId).toBe(84);
  });

  it("PUT es idempotente por (userId,kind) — actualiza, no duplica", async () => {
    const body = {
      userId: targetUserId, kind: "QA_WORK", entityType: "contract",
      clientId: 36, clientName: "UDD", contractId: 82,
      entityName: "1541_Célula QA - Braulio Benardis", taskTypeId: 3, taskTypeName: "QA",
    };
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(r.status).toBe(200);
    const rows = await prisma.flowpilotMapping.findMany({ where: { userId: targetUserId, kind: "QA_WORK" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contractId).toBe(82);
  });

  it("PUT rechaza contract sin contractId (400)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "BAD", entityType: "contract",
        clientId: 36, clientName: "UDD", entityName: "x", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(r.status).toBe(400);
  });

  it("GET lista las homologaciones del usuario (admin)", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/mappings?userId=${targetUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const rows = await r.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((x: any) => x.kind === "QA_WORK")).toBe(true);
  });

  it("analista (no admin) recibe 403 en GET y PUT", async () => {
    const g = await fetch(`${API_URL}/api/flowpilot/mappings?userId=${targetUserId}`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    expect(g.status).toBe(403);
    const p = await fetch(`${API_URL}/api/flowpilot/mappings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${analystToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId, kind: "QA_WORK", entityType: "contract",
        clientId: 36, clientName: "UDD", contractId: 84, entityName: "x", taskTypeId: 3, taskTypeName: "QA",
      }),
    });
    expect(p.status).toBe(403);
  });

  it("DELETE elimina la homologación (admin)", async () => {
    const created = await prisma.flowpilotMapping.create({
      data: {
        userId: targetUserId, kind: "TMP_DEL", entityType: "project",
        clientId: 18, clientName: "Interno", projectId: 54,
        entityName: "Vacaciones", taskTypeId: 20, taskTypeName: "vacacion",
      },
    });
    const r = await fetch(`${API_URL}/api/flowpilot/mappings/${created.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(204);
    const gone = await prisma.flowpilotMapping.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
```

- [ ] **Step 2: Correr (requiere API+DB arriba con las env vars).** Desde `apps/api` (PowerShell):
```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/qa_metrics?schema=public"; $env:ENCRYPTION_KEY="dev-encryption-key-0123456789abcdef"; $env:API_URL="http://localhost:4000"; npx vitest run src/__tests__/flowpilot-mappings.test.ts
```
Expected: 6 passing. (Si el server no refleja el router nuevo, reiniciarlo.)

> Si no hay DB/API disponible en el entorno del subagente, dejar el test escrito y
> reportar DEFERRED; el coordinador lo corre.

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/__tests__/flowpilot-mappings.test.ts
git commit -m "test(flowpilot): CRUD de homologaciones + authz"
```

---

## Task 4: Frontend — api-client + página de homologación + menú

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx`
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Agregar `flowpilotApi` y tipos** al final de `apps/web/lib/api-client.ts`:

```ts
// ---------- FlowPilot homologación ----------

export interface FlowpilotCatalogItem { id: number; name: string; }

export interface FlowpilotMapping {
  id: string;
  userId: string;
  kind: string;
  entityType: "contract" | "project";
  clientId: number;
  clientName: string;
  contractId: number | null;
  projectId: number | null;
  entityName: string;
  taskTypeId: number;
  taskTypeName: string;
}

export type FlowpilotMappingInput = Omit<FlowpilotMapping, "id">;

export const flowpilotApi = {
  clients: (entityType: "contract" | "project") =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/clients?entityType=${entityType}`).then((r) => r.data),
  contracts: (clientId: number) =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/contracts?clientId=${clientId}`).then((r) => r.data),
  projects: (clientId: number) =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/projects?clientId=${clientId}`).then((r) => r.data),
  taskTypes: () =>
    apiClient<{ data: FlowpilotCatalogItem[] }>(`/api/flowpilot/catalog/task-types`).then((r) => r.data),
  listMappings: (userId: string) =>
    apiClient<FlowpilotMapping[]>(`/api/flowpilot/mappings?userId=${userId}`),
  upsertMapping: (data: FlowpilotMappingInput) =>
    apiClient<FlowpilotMapping>(`/api/flowpilot/mappings`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMapping: (id: string) =>
    apiClient<void>(`/api/flowpilot/mappings/${id}`, { method: "DELETE" }),
};
```

> NOTA: `usersApi` o equivalente para listar usuarios. Revisar en `api-client.ts`
> si ya existe un listador de usuarios; si no, usar `apiClient<...>("/api/users")`
> directamente en la página. Confirmar la forma de `/api/users` (campos id, name,
> email, role) leyendo `apps/api/src/routes/users.routes.ts` antes de usarla.

- [ ] **Step 2: Crear la página** `apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient, flowpilotApi, type FlowpilotMapping, type FlowpilotCatalogItem } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

interface UserLite { id: string; name: string; email: string; role?: { name: string } }

const KIND_OPTIONS = ["QA_WORK", "VACACIONES", "LICENCIA", "FERIADO"];

export default function FlowpilotHomologacionPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [mappings, setMappings] = useState<FlowpilotMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<FlowpilotMapping> | null>(null);

  useEffect(() => {
    apiClient<UserLite[]>("/api/users")
      .then((list) => setUsers(list.filter((u) => u.role?.name === "QA_ANALYST" || u.role?.name === "QA_LEAD")))
      .catch((e) => setError(e?.message ?? "Error cargando usuarios"));
  }, []);

  const loadMappings = useCallback((uid: string) => {
    if (!uid) return;
    setLoading(true);
    flowpilotApi.listMappings(uid)
      .then(setMappings)
      .catch((e) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (userId) loadMappings(userId); }, [userId, loadMappings]);

  if (user && user.role?.name !== "ADMIN" && user.role?.name !== "QA_LEAD") {
    return <div className="max-w-md mx-auto mt-24 text-center text-sm text-gray-500">Acceso restringido a ADMIN/QA_LEAD.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Admin / FlowPilot</div>
        <h1 className="text-xl font-bold text-gray-900">Homologación de carga de horas</h1>
        <p className="text-xs text-gray-400 mt-0.5">Define, por usuario, dónde se imputan sus horas en FlowPilot.</p>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-600">Usuario:</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">Selecciona…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </select>
        {userId && (
          <button onClick={() => setEditing({ userId, kind: "QA_WORK", entityType: "contract" })}
            className="ml-auto text-sm bg-[#2E5FA3] text-white rounded-md px-3 py-1.5 hover:bg-[#264f88]">
            + Agregar homologación
          </button>
        )}
      </div>

      {loading && <div className="text-sm text-gray-400">Cargando…</div>}

      {userId && !loading && (
        <div className="space-y-2">
          {mappings.length === 0 && <div className="text-sm text-gray-400 italic">Sin homologaciones para este usuario.</div>}
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-md px-4 py-3 text-sm">
              <span className="font-semibold text-gray-800 w-28">{m.kind}</span>
              <span className="text-gray-500">{m.entityType === "contract" ? "Contrato" : "Proyecto"}</span>
              <span className="text-gray-700">{m.clientName} — {m.entityName}</span>
              <span className="text-gray-400">· {m.taskTypeName}</span>
              <button onClick={() => setEditing(m)} className="ml-auto text-[#2E5FA3] hover:underline">Editar</button>
              <button onClick={async () => { await flowpilotApi.deleteMapping(m.id); loadMappings(userId); }} className="text-red-600 hover:underline">Eliminar</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MappingEditor
          initial={editing}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadMappings(userId); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function MappingEditor({
  initial, userId, onClose, onSaved, onError,
}: {
  initial: Partial<FlowpilotMapping>;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [kind, setKind] = useState(initial.kind ?? "QA_WORK");
  const [entityType, setEntityType] = useState<"contract" | "project">(initial.entityType ?? "contract");
  const [clients, setClients] = useState<FlowpilotCatalogItem[]>([]);
  const [entities, setEntities] = useState<FlowpilotCatalogItem[]>([]);
  const [taskTypes, setTaskTypes] = useState<FlowpilotCatalogItem[]>([]);
  const [clientId, setClientId] = useState<number | null>(initial.clientId ?? null);
  const [entityId, setEntityId] = useState<number | null>(initial.contractId ?? initial.projectId ?? null);
  const [taskTypeId, setTaskTypeId] = useState<number | null>(initial.taskTypeId ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { flowpilotApi.clients(entityType).then(setClients).catch((e) => onError(e?.message ?? "Error clientes")); }, [entityType, onError]);
  useEffect(() => { flowpilotApi.taskTypes().then(setTaskTypes).catch((e) => onError(e?.message ?? "Error tipos de tarea")); }, [onError]);
  useEffect(() => {
    if (!clientId) { setEntities([]); return; }
    const p = entityType === "contract" ? flowpilotApi.contracts(clientId) : flowpilotApi.projects(clientId);
    p.then(setEntities).catch((e) => onError(e?.message ?? "Error entidades"));
  }, [clientId, entityType, onError]);

  const save = async () => {
    const client = clients.find((c) => c.id === clientId);
    const entity = entities.find((e) => e.id === entityId);
    const tt = taskTypes.find((t) => t.id === taskTypeId);
    if (!client || !entity || !tt) { onError("Completa cliente, entidad y tipo de tarea"); return; }
    setSaving(true);
    try {
      await flowpilotApi.upsertMapping({
        userId, kind, entityType,
        clientId: client.id, clientName: client.name,
        contractId: entityType === "contract" ? entity.id : null,
        projectId: entityType === "project" ? entity.id : null,
        entityName: entity.name, taskTypeId: tt.id, taskTypeName: tt.name,
      });
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Error guardando");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[460px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">Homologación</h2>
        <Field label="Tipo (kind)">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
            {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Tipo de Entidad">
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value as any); setClientId(null); setEntityId(null); }} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="contract">Contrato</option>
            <option value="project">Proyecto</option>
          </select>
        </Field>
        <Field label="Cliente">
          <select value={clientId ?? ""} onChange={(e) => { setClientId(Number(e.target.value) || null); setEntityId(null); }} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={entityType === "contract" ? "Contrato" : "Proyecto"}>
          <select value={entityId ?? ""} onChange={(e) => setEntityId(Number(e.target.value) || null)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo de Tarea">
          <select value={taskTypeId ?? ""} onChange={(e) => setTaskTypeId(Number(e.target.value) || null)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm px-3 py-1.5 rounded bg-[#2E5FA3] text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Agregar el ítem de menú** en `apps/web/components/layout/Sidebar.tsx`. Dentro del bloque `if (roleName === "ADMIN")` (sección "admin"), agregar el item junto a "Carga diaria":
```tsx
          { label: "Homologación FlowPilot", href: "/admin/flowpilot-homologacion", icon: iconClock },
```
(reusar `iconClock` ya definido en el archivo.)

- [ ] **Step 4: Verificación manual en el navegador** (servidores ya arriba). Ver Task de validación abajo. Confirmar que compila: `npx tsc --noEmit` en `apps/web` (o que el dev server compila sin error).

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/api-client.ts "apps/web/app/(app)/admin/flowpilot-homologacion/page.tsx" apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): pantalla admin de homologación FlowPilot + menú"
```

---

## Validación manual (coordinador, en el navegador)

Para que el proxy de catálogos funcione en vivo, el ADMIN logueado debe tener una
credencial FlowPilot válida capturada. El admin seed (`admin@qametrics.com`) NO
tiene login válido en FlowPilot. Crear localmente un admin con credenciales reales
de FlowPilot QA:

- [ ] Crear/actualizar usuario local `jcaradeux@inovabiz.com` con rol ADMIN y password = el password real de FlowPilot QA (vía script con el hash de `auth.service`, o registrando por la UI/seed). Loguearse con él en qa_metrics → captura la credencial FlowPilot.
- [ ] Abrir `http://localhost:3000/admin/flowpilot-homologacion`, elegir un analista, "Agregar homologación", y verificar que los dropdowns de Cliente/Contrato/Tipo de Tarea se pueblan **en vivo desde FlowPilot**. Guardar y confirmar que la fila persiste (y en la DB).

---

## Self-Review (hecho)
- **Cobertura de spec (Plan 2):** proxy de catálogos ✓ (Task 2), CRUD de mappings con authz ✓ (Task 2–3), UI admin con dropdowns en cascada en vivo ✓ (Task 4), captura de credencial para ADMIN/QA_LEAD ✓ (Task 1).
- **Sin placeholders:** código real en cada paso. Las NOTAs (`/api/users` shape) son verificaciones puntuales, no TODOs.
- **Consistencia de tipos:** `FlowpilotCatalogItem`/`FlowpilotMapping` coinciden entre `api-client.ts` (web) y las respuestas del router; `entityType` ∈ {contract, project}; el payload del PUT calza con `upsertMappingSchema`.

## Roadmap — Plan 3 (siguiente)
Builder día→entradas (occupation + mapeo por kind), `GET /api/flowpilot/preview`, `POST /api/flowpilot/sync` idempotente (borrar+recrear con DELETE confirmado), conexión `test`, y página "Registro de Horas" del analista con preview editable y botón Enviar.
