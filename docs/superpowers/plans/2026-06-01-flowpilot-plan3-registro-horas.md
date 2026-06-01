# FlowPilot Integración — Plan 3: Registro de Horas (envío del día)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el analista, desde una página propia "Registro de Horas", vea el día armado automáticamente (actividades + trabajo en HU con horas repartidas), lo ajuste, y lo envíe a FlowPilot de forma idempotente.

**Architecture:** Un builder (`day-entries.ts`) arma las entradas candidatas del día a partir de `Activity` (horas reales) y `DailyRecord` (HU trabajadas), repartiendo las horas productivas (jornada 8h − actividades − ausencias) entre las HU con una función pura de reparto. Cada entrada resuelve su destino con `FlowpilotMapping[userId, kind]`. El endpoint de sync crea las entradas vía `FlowpilotClient` (sesión del propio analista) y registra `FlowpilotSyncLog`; reenviar borra las anteriores y recrea.

**Tech Stack:** Express + Prisma, vitest, Next.js (app router), TypeScript ESM. Reusa `occupation.ts` (lógica de horas) y el `FlowpilotClient`/conexión del Plan 1–2.

**Depends on:** Planes 1 y 2 (adapter, credenciales/conexión, `FlowpilotMapping`, proxy/CRUD).
**Spec:** `docs/superpowers/specs/2026-06-01-flowpilot-integration-design.md`

---

## File Structure
- `apps/api/src/lib/flowpilot/hours-distribution.ts` — crear: reparto puro de horas.
- `apps/api/src/lib/flowpilot/day-entries.ts` — crear: builder día→entradas (DB).
- `apps/api/src/routes/flowpilot.routes.ts` — modificar: `GET /preview`, `POST /sync`.
- `apps/api/src/__tests__/flowpilot-hours-distribution.test.ts` — crear: unit del reparto.
- `apps/api/src/__tests__/flowpilot-preview.test.ts` — crear: integración del preview.
- `apps/web/lib/api-client.ts` — modificar: `flowpilotApi.preview/sync`.
- `apps/web/app/(app)/registro-horas/page.tsx` — crear: UI del analista.
- `apps/web/components/layout/Sidebar.tsx` — modificar: ítem "Registro de Horas".

---

## Task 1: Reparto puro de horas (TDD unit)

**Files:**
- Create: `apps/api/src/lib/flowpilot/hours-distribution.ts`
- Test: `apps/api/src/__tests__/flowpilot-hours-distribution.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
// apps/api/src/__tests__/flowpilot-hours-distribution.test.ts
import { describe, it, expect } from "vitest";
import { distributeHours, roundToStep } from "../lib/flowpilot/hours-distribution.js";

describe("roundToStep", () => {
  it("redondea a 0.5", () => {
    expect(roundToStep(1.66, 0.5)).toBe(1.5);
    expect(roundToStep(1.75, 0.5)).toBe(2);
    expect(roundToStep(0.24, 0.5)).toBe(0);
  });
});

describe("distributeHours", () => {
  it("lista vacía → mapa vacío", () => {
    expect(distributeHours([], 6).size).toBe(0);
  });

  it("total 0 → todos 0", () => {
    const out = distributeHours([{ key: "a", weight: 1 }, { key: "b", weight: 1 }], 0);
    expect(out.get("a")).toBe(0);
    expect(out.get("b")).toBe(0);
  });

  it("pesos iguales reparten parejo", () => {
    const out = distributeHours([{ key: "a", weight: 1 }, { key: "b", weight: 1 }], 6);
    expect(out.get("a")).toBe(3);
    expect(out.get("b")).toBe(3);
  });

  it("pondera por peso (2:1 de 6 → 4 y 2)", () => {
    const out = distributeHours([{ key: "a", weight: 2 }, { key: "b", weight: 1 }], 6);
    expect(out.get("a")).toBe(4);
    expect(out.get("b")).toBe(2);
  });

  it("peso total 0 → reparte parejo", () => {
    const out = distributeHours([{ key: "a", weight: 0 }, { key: "b", weight: 0 }], 5);
    // 2.5 / 2.5
    expect(out.get("a")! + out.get("b")!).toBe(5);
  });

  it("cuadra el total tras redondear a 0.5 (3 items de 5h)", () => {
    const out = distributeHours(
      [{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }], 5
    );
    const sum = [...out.values()].reduce((s, n) => s + n, 0);
    expect(sum).toBe(5);
    for (const v of out.values()) expect(v % 0.5).toBe(0);
  });
});
```

- [ ] **Step 2: Correr → falla.** `npx vitest run src/__tests__/flowpilot-hours-distribution.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
// apps/api/src/lib/flowpilot/hours-distribution.ts
export function roundToStep(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

export interface WeightedItem { key: string; weight: number; }

// Reparte `total` horas entre items, ponderado por weight (parejo si todos 0),
// redondeando cada uno a `step`, y ajustando el residuo en el item mayor para
// que la suma sea exactamente roundToStep(total).
export function distributeHours(
  items: WeightedItem[], total: number, step = 0.5,
): Map<string, number> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;

  const target = roundToStep(Math.max(0, total), step);
  if (target <= 0) {
    for (const it of items) out.set(it.key, 0);
    return out;
  }

  const totalWeight = items.reduce((s, it) => s + Math.max(0, it.weight), 0);
  const shares = items.map((it) => {
    const frac = totalWeight > 0 ? Math.max(0, it.weight) / totalWeight : 1 / items.length;
    return { key: it.key, raw: target * frac };
  });

  // Redondeo inicial a step.
  let assigned = 0;
  for (const s of shares) {
    const r = roundToStep(s.raw, step);
    out.set(s.key, r);
    assigned += r;
  }

  // Ajustar residuo (positivo o negativo) en pasos de `step`, empezando por los
  // items de mayor `raw` (para residuo+) o menor valor asignado (para residuo−).
  let residual = roundToStep(target - assigned, step);
  const order = [...shares].sort((a, b) => b.raw - a.raw);
  let i = 0;
  while (Math.abs(residual) >= step - 1e-9 && order.length > 0) {
    const key = order[i % order.length]!.key;
    const cur = out.get(key)!;
    const next = residual > 0 ? cur + step : Math.max(0, cur - step);
    if (next !== cur) { out.set(key, next); residual = roundToStep(residual - (next - cur), step); }
    i++;
    if (i > 10000) break; // backstop
  }
  return out;
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/lib/flowpilot/hours-distribution.ts apps/api/src/__tests__/flowpilot-hours-distribution.test.ts
git commit -m "feat(flowpilot): reparto puro de horas (ponderado, redondeo 0.5)"
```

---

## Task 2: Builder día→entradas

**Files:**
- Create: `apps/api/src/lib/flowpilot/day-entries.ts`

- [ ] **Step 1: Implementar el builder**

```ts
// apps/api/src/lib/flowpilot/day-entries.ts
import { prisma } from "@qa-metrics/database";
import { distributeHours } from "./hours-distribution.js";

const MS_PER_HOUR = 1000 * 60 * 60;
const WORKDAY_HOURS = 8;

const ABSENCE_NAMES = new Set([
  "vacaciones", "ausencia", "licencia", "licencia médica", "licencia medica",
  "permiso", "feriado", "día administrativo", "dia administrativo",
]);
function isAbsence(name: string, bandType?: string | null): boolean {
  if (bandType === "ABSENCE") return true;
  return ABSENCE_NAMES.has(name.trim().toLowerCase());
}
// Categoría de ausencia → kind homologable.
function absenceKind(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes("vacacion")) return "VACACIONES";
  if (n.includes("licencia")) return "LICENCIA";
  if (n.includes("feriado")) return "FERIADO";
  return "VACACIONES";
}

export interface PreviewEntry {
  kind: string;
  description: string;
  hours: number;
  source: "activity" | "story";
  refId: string;
  mapped: boolean;
  destination: {
    entityType: string; clientId: number; clientName: string;
    contractId: number | null; projectId: number | null;
    entityName: string; taskTypeId: number; taskTypeName: string;
  } | null;
}

export interface DayPreview {
  date: string;
  capacityHours: number;
  totalHours: number;
  allMapped: boolean;
  withinCap: boolean;
  entries: PreviewEntry[];
}

export async function buildDayPreview(userId: string, date: string): Promise<DayPreview> {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * MS_PER_HOUR);

  const testers = await prisma.tester.findMany({
    where: { userId },
    select: { id: true, allocation: true },
  });
  const testerIds = testers.map((t) => t.id);
  const capacityHours = Math.min(
    WORKDAY_HOURS,
    testers.reduce((s, t) => s + WORKDAY_HOURS * (t.allocation / 100), 0) || WORKDAY_HOURS,
  );

  const [activities, records, mappings] = await Promise.all([
    prisma.activity.findMany({
      where: { testerId: { in: testerIds }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      include: { category: true },
    }),
    prisma.dailyRecord.findMany({
      where: { testerId: { in: testerIds }, date: dayStart },
      include: { assignment: { include: { story: { select: { externalId: true, title: true } } } } },
    }),
    prisma.flowpilotMapping.findMany({ where: { userId } }),
  ]);
  const mapByKind = new Map(mappings.map((m) => [m.kind, m]));

  const entries: PreviewEntry[] = [];
  let activityHours = 0;
  let absenceHours = 0;

  for (const a of activities) {
    const start = a.startAt > dayStart ? a.startAt : dayStart;
    const end = a.endAt < dayEnd ? a.endAt : dayEnd;
    const hours = Math.max(0, (end.getTime() - start.getTime()) / MS_PER_HOUR);
    if (hours <= 0) continue;
    const absence = isAbsence(a.category.name, (a.category as any).bandType);
    const kind = absence ? absenceKind(a.category.name) : "QA_WORK";
    if (absence) absenceHours += hours; else activityHours += hours;
    entries.push(makeEntry(kind, `${a.category.name}${a.notes ? ` — ${a.notes}` : ""}`, hours, "activity", a.id, mapByKind));
  }

  const productive = Math.max(0, Math.min(WORKDAY_HOURS, capacityHours) - activityHours - absenceHours);
  const weighted = records.map((r) => ({ key: r.assignmentId, weight: r.designed + r.executed + r.defects }));
  const dist = distributeHours(weighted, productive, 0.5);
  for (const r of records) {
    const hours = dist.get(r.assignmentId) ?? 0;
    if (hours <= 0) continue;
    const st = r.assignment?.story;
    const desc = st ? (st.externalId ? `${st.externalId} — ${st.title}` : st.title) : "Trabajo QA";
    entries.push(makeEntry("QA_WORK", desc, hours, "story", r.assignmentId, mapByKind));
  }

  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;
  return {
    date,
    capacityHours: Math.round(capacityHours * 100) / 100,
    totalHours,
    allMapped: entries.every((e) => e.mapped),
    withinCap: totalHours <= WORKDAY_HOURS + 1e-9,
    entries,
  };
}

function makeEntry(
  kind: string, description: string, hours: number,
  source: "activity" | "story", refId: string,
  mapByKind: Map<string, any>,
): PreviewEntry {
  const m = mapByKind.get(kind);
  return {
    kind, description, hours: Math.round(hours * 100) / 100, source, refId,
    mapped: !!m,
    destination: m ? {
      entityType: m.entityType, clientId: m.clientId, clientName: m.clientName,
      contractId: m.contractId, projectId: m.projectId, entityName: m.entityName,
      taskTypeId: m.taskTypeId, taskTypeName: m.taskTypeName,
    } : null,
  };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` desde `apps/api` → sin errores.

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/lib/flowpilot/day-entries.ts
git commit -m "feat(flowpilot): builder día→entradas (actividades + HU con reparto)"
```

---

## Task 3: Endpoints preview + sync

**Files:**
- Modify: `apps/api/src/routes/flowpilot.routes.ts`

- [ ] **Step 1: Agregar imports** en `flowpilot.routes.ts`:
```ts
import { buildDayPreview } from "../lib/flowpilot/day-entries.js";
import crypto from "node:crypto";
```

- [ ] **Step 2: Agregar los endpoints** (antes de `export default router;`). Cualquier usuario autenticado opera sobre SU propio día:

```ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Preview del día del usuario actual (no envía nada).
router.get("/preview", async (req: AuthRequest, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !DATE_RE.test(date)) { res.status(400).json({ error: "date=YYYY-MM-DD requerido" }); return; }
  const preview = await buildDayPreview(req.user!.id, date);
  const log = await prisma.flowpilotSyncLog.findUnique({ where: { userId_date: { userId: req.user!.id, date: new Date(`${date}T00:00:00`) } } });
  res.json({ ...preview, sync: log ? { status: log.status, sentAt: log.sentAt, hoursTotal: log.hoursTotal } : null });
});

// Envía el día a FlowPilot. Body: { date, entries: [{kind, description, hours}] }.
// Idempotente: si ya se envió y el contenido cambió, borra las entradas previas y recrea.
router.post("/sync", async (req: AuthRequest, res) => {
  const date = (req.body ?? {}).date;
  const rawEntries = (req.body ?? {}).entries;
  if (!date || !DATE_RE.test(date) || !Array.isArray(rawEntries)) {
    res.status(400).json({ error: "date y entries requeridos" }); return;
  }
  // Re-resolver destinos desde la homologación (no confiar en el cliente para el destino).
  const mappings = await prisma.flowpilotMapping.findMany({ where: { userId: req.user!.id } });
  const mapByKind = new Map(mappings.map((m) => [m.kind, m]));

  const entries = rawEntries.map((e: any) => ({
    kind: String(e.kind),
    description: String(e.description ?? "").trim(),
    hours: Number(e.hours),
    m: mapByKind.get(String(e.kind)),
  }));
  if (entries.some((e) => !e.description)) { res.status(400).json({ error: "Toda entrada requiere descripción" }); return; }
  if (entries.some((e) => !(e.hours > 0))) { res.status(400).json({ error: "Horas inválidas" }); return; }
  if (entries.some((e) => !e.m)) { res.status(400).json({ error: "Hay entradas sin homologar; pide a un admin homologar su tipo." }); return; }
  const total = entries.reduce((s, e) => s + e.hours, 0);
  if (total > 8 + 1e-9) { res.status(400).json({ error: `El total (${total}h) supera las 8h diarias.` }); return; }

  const payloadHash = crypto.createHash("sha256")
    .update(JSON.stringify(entries.map((e) => ({ k: e.kind, d: e.description, h: e.hours }))))
    .digest("hex");

  const dateObj = new Date(`${date}T00:00:00`);
  const prev = await prisma.flowpilotSyncLog.findUnique({ where: { userId_date: { userId: req.user!.id, date: dateObj } } });
  if (prev && prev.status === "SENT" && prev.payloadHash === payloadHash) {
    res.json({ ok: true, unchanged: true, entryIds: prev.entryIds }); return;
  }

  let session;
  try { session = await getSession(req.user!.id); }
  catch (e) {
    if (e instanceof FlowpilotNoCredentialError || e instanceof FlowpilotInvalidCredentialError) {
      res.status(409).json({ error: e.message, code: "FLOWPILOT_AUTH" }); return;
    }
    res.status(502).json({ error: "No se pudo contactar a FlowPilot" }); return;
  }

  // Si había envío previo, borrar esas entradas antes de recrear (FlowPilot no deduplica).
  if (prev && prev.entryIds.length) {
    for (const id of prev.entryIds) { try { await flowpilotClient.deleteEntry(session, id); } catch { /* continuar */ } }
  }

  const createdIds: number[] = [];
  try {
    for (const e of entries) {
      const created = await flowpilotClient.createEntry(session, {
        entityType: e.m.entityType as "contract" | "project",
        clientId: e.m.clientId, taskTypeId: e.m.taskTypeId,
        date, hoursWorked: e.hours, description: e.description,
        contractId: e.m.contractId, projectId: e.m.projectId,
      });
      createdIds.push(created.id);
    }
  } catch (err) {
    await prisma.flowpilotSyncLog.upsert({
      where: { userId_date: { userId: req.user!.id, date: dateObj } },
      create: { userId: req.user!.id, date: dateObj, entryIds: createdIds, hoursTotal: total, status: "PARTIAL", payloadHash },
      update: { entryIds: createdIds, hoursTotal: total, status: "PARTIAL", payloadHash },
    });
    res.status(502).json({ error: "Falló el envío parcial a FlowPilot", created: createdIds.length }); return;
  }

  await prisma.flowpilotSyncLog.upsert({
    where: { userId_date: { userId: req.user!.id, date: dateObj } },
    create: { userId: req.user!.id, date: dateObj, entryIds: createdIds, hoursTotal: total, status: "SENT", payloadHash },
    update: { entryIds: createdIds, hoursTotal: total, status: "SENT", payloadHash },
  });
  res.json({ ok: true, entryIds: createdIds, hoursTotal: total });
});
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` desde `apps/api`. Confirmar que `FlowpilotInvalidCredentialError` ya está importado (lo está desde el Plan 2); si no, agregar el import.

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/routes/flowpilot.routes.ts
git commit -m "feat(flowpilot): endpoints preview y sync (idempotente, tope 8h)"
```

---

## Task 4: Test de integración del preview

**Files:**
- Create: `apps/api/src/__tests__/flowpilot-preview.test.ts`

> Integración (API+DB). Prueba el preview (sin enviar a FlowPilot). El sync real se
> valida manualmente en el navegador contra FlowPilot QA (crearía entradas reales).
> Si no hay DB/API en el entorno del subagente, dejar el test escrito y reportar DEFERRED.

- [ ] **Step 1: Escribir el test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import { prisma } from "@qa-metrics/database";

describe("FlowPilot preview", () => {
  let token: string;
  let userId: string;
  let testerId: string;

  beforeAll(async () => {
    token = await loginAs("tester1@qametrics.com");
    const u = await prisma.user.findUnique({ where: { email: "tester1@qametrics.com" } });
    userId = u!.id;
    const t = await prisma.tester.findFirst({ where: { userId } });
    testerId = t!.id;
  });

  afterAll(async () => {
    await prisma.flowpilotMapping.deleteMany({ where: { userId, kind: "QA_WORK" } });
  });

  it("400 si falta date", async () => {
    const r = await fetch(`${API_URL}/api/flowpilot/preview`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(400);
  });

  it("devuelve preview del día con entradas e indicador de homologación", async () => {
    // Homologar QA_WORK para el usuario.
    await prisma.flowpilotMapping.upsert({
      where: { userId_kind: { userId, kind: "QA_WORK" } },
      create: {
        userId, kind: "QA_WORK", entityType: "contract", clientId: 36, clientName: "UDD",
        contractId: 84, projectId: null, entityName: "1540", taskTypeId: 3, taskTypeName: "QA",
      },
      update: {},
    });
    const r = await fetch(`${API_URL}/api/flowpilot/preview?date=2026-06-01`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("entries");
    expect(body).toHaveProperty("totalHours");
    expect(body).toHaveProperty("allMapped");
    expect(typeof body.capacityHours).toBe("number");
  });
});
```

- [ ] **Step 2: Correr** (API+DB arriba, con env vars). `npx vitest run src/__tests__/flowpilot-preview.test.ts`. Si no hay DB → DEFERRED.

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/__tests__/flowpilot-preview.test.ts
git commit -m "test(flowpilot): integración del preview del día"
```

---

## Task 5: Frontend — api-client + página + menú

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/app/(app)/registro-horas/page.tsx`
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Tipos + métodos** al final de `apps/web/lib/api-client.ts`:

```ts
export interface FlowpilotPreviewEntry {
  kind: string; description: string; hours: number;
  source: "activity" | "story"; refId: string; mapped: boolean;
}
export interface FlowpilotDayPreview {
  date: string; capacityHours: number; totalHours: number;
  allMapped: boolean; withinCap: boolean;
  entries: FlowpilotPreviewEntry[];
  sync: { status: string; sentAt: string; hoursTotal: number } | null;
}

// (añadir dentro del objeto flowpilotApi existente)
//   preview: (date: string) => apiClient<FlowpilotDayPreview>(`/api/flowpilot/preview?date=${date}`),
//   sync: (date: string, entries: { kind: string; description: string; hours: number }[]) =>
//     apiClient<{ ok: boolean; entryIds?: number[] }>(`/api/flowpilot/sync`, { method: "POST", body: JSON.stringify({ date, entries }) }),
```
Agregar las dos líneas `preview` y `sync` DENTRO del objeto `flowpilotApi` ya existente (no crear otro objeto).

- [ ] **Step 2: Crear la página** `apps/web/app/(app)/registro-horas/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { flowpilotApi, ApiError, type FlowpilotDayPreview, type FlowpilotPreviewEntry } from "@/lib/api-client";

function todayIso() { return new Date().toISOString().slice(0, 10); }
function shiftIso(iso: string, d: number) {
  const x = new Date(`${iso}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10);
}

export default function RegistroHorasPage() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<FlowpilotDayPreview | null>(null);
  const [rows, setRows] = useState<FlowpilotPreviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback((d: string) => {
    setLoading(true); setError(null);
    flowpilotApi.preview(d)
      .then((p) => { setData(p); setRows(p.entries); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) setNeedsConnect(true);
        else setError(e?.message ?? "Error");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const total = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const allMapped = rows.every((r) => r.mapped);
  const overCap = total > 8 + 1e-9;
  const canSend = !sending && rows.length > 0 && allMapped && !overCap;

  const setHours = (i: number, v: number) =>
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, hours: v } : r));
  const setDesc = (i: number, v: string) =>
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, description: v } : r));

  const send = async () => {
    setSending(true); setError(null);
    try {
      await flowpilotApi.sync(date, rows.map((r) => ({ kind: r.kind, description: r.description, hours: r.hours })));
      setToast("Día enviado a FlowPilot");
      setTimeout(() => setToast(null), 2500);
      load(date);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) setNeedsConnect(true);
      else setError(e?.message ?? "Error al enviar");
    } finally { setSending(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Registro de Horas</div>
          <h1 className="text-xl font-bold text-gray-900">Mis horas del día → FlowPilot</h1>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
          <button onClick={() => setDate((d) => shiftIso(d, -1))} className="px-2 h-7 text-gray-500 hover:bg-gray-100 rounded">‹</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-[11px] font-mono px-2 h-7 bg-transparent outline-none" />
          <button onClick={() => setDate((d) => shiftIso(d, 1))} className="px-2 h-7 text-gray-500 hover:bg-gray-100 rounded">›</button>
          <button onClick={() => setDate(todayIso())} className="px-2 h-7 text-[11px] text-gray-600 hover:bg-gray-100 rounded">Hoy</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}
      {data?.sync?.status === "SENT" && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] text-emerald-800">Ya enviado ({data.sync.hoursTotal}h). Reenviar reemplaza lo anterior.</div>}

      {loading ? (
        <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {rows.length === 0 && <div className="text-sm text-gray-400 italic">No hay actividades ni trabajo en HU registrados para este día.</div>}
            {rows.map((r, i) => (
              <div key={r.source + r.refId} className={`flex items-center gap-3 bg-white border rounded-md px-4 py-2.5 ${r.mapped ? "border-gray-200" : "border-amber-300 bg-amber-50/40"}`}>
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${r.source === "story" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{r.source === "story" ? "HU" : "Act"}</span>
                <input value={r.description} onChange={(e) => setDesc(i, e.target.value)} className="flex-1 text-sm border border-transparent hover:border-gray-200 focus:border-[#4A90D9] rounded px-2 py-1 outline-none" />
                {!r.mapped && <span className="text-[10px] text-amber-700 font-medium">sin homologar ({r.kind})</span>}
                <input type="number" step="0.5" min="0" max="8" value={r.hours} onChange={(e) => setHours(i, Number(e.target.value))} className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-right outline-none focus:border-[#4A90D9]" />
                <span className="text-[11px] text-gray-400">h</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className={`text-sm font-semibold ${overCap ? "text-red-600" : "text-gray-700"}`}>
              Total: {total.toFixed(1)} / 8h {overCap && "· supera la jornada"}
            </div>
            <button onClick={send} disabled={!canSend} className="bg-[#2E5FA3] text-white text-sm rounded-md px-4 py-2 disabled:opacity-40 hover:bg-[#264f88]">
              {sending ? "Enviando…" : "Enviar a FlowPilot"}
            </button>
          </div>
          {!allMapped && rows.length > 0 && <div className="mt-2 text-[12px] text-amber-700">Hay entradas sin homologar — pide a un admin configurarlas en Homologación FlowPilot.</div>}
        </>
      )}

      {needsConnect && (
        <ConnectModal onClose={() => setNeedsConnect(false)} onConnected={() => { setNeedsConnect(false); load(date); }} />
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs rounded-md px-3.5 py-2.5">{toast}</div>}
    </div>
  );
}

function ConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!password) { setErr("Ingresa tu clave de FlowPilot"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await flowpilotApi.connect(password);
      if (r.valid) onConnected(); else setErr("Credencial inválida");
    } catch (e: any) { setErr(e?.message ?? "No se pudo conectar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">Conectar con FlowPilot</h2>
        <p className="text-xs text-gray-500">Ingresa tu clave de FlowPilot para enviar tus horas.</p>
        <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Clave de FlowPilot" />
        {err && <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600">Cancelar</button>
          <button onClick={submit} disabled={busy} className="text-sm px-3 py-1.5 rounded bg-[#2E5FA3] text-white disabled:opacity-50">{busy ? "Conectando…" : "Conectar"}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Menú en `Sidebar.tsx`.** En la sección del analista (`if (isAnalyst) { sections.push({ key: "work", items: [ ... ] }) }`), agregar como primer item:
```tsx
        { label: "Registro de Horas", href: "/registro-horas", icon: iconClock },
```
(Reusar `iconClock`, ya definido.)

- [ ] **Step 4: Verificar** — `npx tsc --noEmit` desde `apps/web` → sin errores en los archivos nuevos.

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/api-client.ts "apps/web/app/(app)/registro-horas/page.tsx" apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): página Registro de Horas (preview editable + envío a FlowPilot)"
```

---

## Validación manual (coordinador)
Con servidores arriba y un analista homologado:
- [ ] Homologar `QA_WORK` (y `VACACIONES` si aplica) para el analista en Homologación FlowPilot.
- [ ] Entrar como ese analista → "Registro de Horas" → ver el día armado, ajustar horas, **Enviar**.
- [ ] Verificar en FlowPilot que las entradas se crearon; reenviar y confirmar que reemplaza (no duplica).

## Self-Review (hecho)
- **Cobertura:** builder (Task 1–2), preview+sync idempotente con tope 8h (Task 3), test preview (Task 4), UI analista con preview editable + conexión + envío (Task 5). Cubre la spec del Plan 3.
- **Sin placeholders:** código real en cada paso.
- **Consistencia:** `PreviewEntry`/`FlowpilotDayPreview` coinciden entre `day-entries.ts`, el endpoint y `api-client.ts`; el sync re-resuelve destinos desde `FlowpilotMapping` (no confía en el cliente); idempotencia por `payloadHash` + borrar/recrear con el `DELETE` confirmado en Fase 0.
