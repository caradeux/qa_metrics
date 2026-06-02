# QA Automation Track — Web UI (Management + Weekly Registration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MANDATORY (per repo `AGENTS.md`):** This repo runs **Next.js 16.2.3** with breaking changes vs. older versions. Before writing any frontend code, the relevant facts have already been distilled here. Key gotchas baked into this plan: dynamic-route `params` is a **`Promise`** — in client components read it with `const { id } = use(params)` (React's `use`), matching the existing repo pattern (`clients/[id]/edit/page.tsx`). `useRouter`/`usePathname`/`useParams` import from **`next/navigation`** (never `next/router`).

**Goal:** Give the automation engineer a web UI to (a) manage Test Lines (CRUD) and (b) self-register their weekly automation work (scripts created/refactored/fixed + executions pass/fail) in a grid, mirroring the manual track's `mi-semana` + `WeeklyGrid`.

**Architecture:** All pages are client components (`"use client"`) using the existing `apiClient` fetch wrapper + `useEffect`/`useState` (no server components, no react-hook-form — the repo convention). Self-service registration routes the logged-in user to their automation tester via a new `modality` field on `/api/testers/me`, and a dedicated seeded automation-engineer user makes it testable. New pages live under `app/(app)/automation/`. Permission gating uses the **already-seeded** backend resources `test-lines` and `automation-assignments` (records are ownership-gated, no resource).

**Tech Stack:** Next.js 16 (app router), React 19 `use()`, TypeScript, Tailwind v4 (design tokens: `bg-primary`/`text-secondary`/`border-border`/`bg-card`/`text-danger`), `date-fns` (+ `es` locale). Backend: Express 5 + Prisma 7.

**Prerequisite:** Plan 1 (backend foundation) is merged/applied: `/api/test-lines`, `/api/automation-assignments`, `/api/automation-records` exist and the dev DB is migrated + seeded. The dev API runs on :4000 (`tsx watch`, hot-reload); the web dev server runs on :3000 (`next dev`).

**Scope:** Management CRUD + weekly registration grid + plumbing (api-client, permissions registry, sidebar). The automation **dashboard** (script curves, pass-rate) is intentionally deferred to a later plan.

---

## File Structure

**Backend (small enablement changes):**
- Modify `apps/api/src/routes/testers.routes.ts` — add `modality` to the `/me` project select.
- Modify `packages/database/prisma/seed.ts` — add a dedicated automation-engineer user linked to the automation tester.

**Frontend — create:**
- `apps/web/app/(app)/automation/test-lines/page.tsx` — list + delete (mirror `clients/page.tsx`).
- `apps/web/app/(app)/automation/test-lines/new/page.tsx` — create form.
- `apps/web/app/(app)/automation/test-lines/[id]/edit/page.tsx` — edit form.
- `apps/web/app/(app)/automation/registro-semanal/page.tsx` — self-service weekly page (mirror `mi-semana/page.tsx`).
- `apps/web/components/automation/AutomationWeeklyGrid.tsx` — the grid (focused adaptation of `WeeklyGrid.tsx`).

**Frontend — modify:**
- `apps/web/lib/api-client.ts` — add types + `automationTestLinesApi`, `automationAssignmentsApi`, `automationRecordsApi`.
- `apps/web/lib/permissions.ts` — register `test-lines` + `automation-assignments` in `RESOURCES`, `RESOURCE_LABELS`, `RESOURCE_GROUPS`.
- `apps/web/app/(app)/mi-semana/page.tsx` — filter OUT automation testers (so they only appear in the automation grid).
- `apps/web/components/layout/Sidebar.tsx` — add a "QA Automation" nav section.

---

## Task 1: Backend enablement — `modality` in `/me` + automation-engineer seed user

**Files:**
- Modify: `apps/api/src/routes/testers.routes.ts`
- Modify: `packages/database/prisma/seed.ts`

- [ ] **Step 1: Add `modality` to the `/me` project select**

In `apps/api/src/routes/testers.routes.ts`, the `/me` handler's `select` currently has (around line 21):

```ts
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
```

Replace it with:

```ts
      project: { select: { id: true, name: true, modality: true, client: { select: { name: true } } } },
```

- [ ] **Step 2: Add a dedicated automation-engineer user linked to the automation tester in the seed**

In `packages/database/prisma/seed.ts`, inside the automation fixtures block, AFTER the line `const autoTester1 = await ensureAutoTester("Tester Uno", autoProject.id);` (and its `autoTester2` sibling), add:

```ts
  // Dedicated automation-engineer user for self-service weekly registration.
  // Linked ONLY to the automation tester, so GET /api/testers/me returns a
  // single (automation) profile for this user — no manual-track pollution.
  const passAnalystAuto = await bcrypt.hash("Analyst2024!", 10);
  const autoEngineerUser = await prisma.user.upsert({
    where: { email: "auto.engineer@qametrics.com" },
    update: { roleId: qaAnalystRole.id, active: true, name: "Auto Engineer" },
    create: { email: "auto.engineer@qametrics.com", password: passAnalystAuto, name: "Auto Engineer", roleId: qaAnalystRole.id },
  });
  await prisma.tester.update({ where: { id: autoTester1.id }, data: { userId: autoEngineerUser.id } });
```

> Note: `ensureAutoTester` (added in Plan 1's fix) sets `userId: null` on existing rows. Because this step runs AFTER it and re-links `autoTester1` to the dedicated user, the order is correct: `autoTester1` ends linked to `auto.engineer@qametrics.com`. `autoTester2` stays unlinked. The QA-analyst users `tester1/tester2@qametrics.com` remain linked only to their manual testers, so `testers-me` behavior for them is unchanged.

- [ ] **Step 3: Reseed and verify**

Run:

```
npm run db:seed --workspace @qa-metrics/database
```

Then verify the dedicated user sees exactly one automation tester (login issues a fresh token with the seeded link):

```
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"auto.engineer@qametrics.com","password":"Analyst2024!"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
curl -s http://localhost:4000/api/testers/me -H "Authorization: Bearer $TOKEN"
```

Expected: a JSON array with exactly ONE element whose `project.modality` is `"AUTOMATION"` and `project.name` is `"Automatización Core Bancario"`.

- [ ] **Step 4: Commit**

```
git add apps/api/src/routes/testers.routes.ts packages/database/prisma/seed.ts
git commit -m "feat(api): expose modality in /testers/me + seed automation engineer user" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: api-client + permissions registry

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/lib/permissions.ts`

- [ ] **Step 1: Add automation types + API objects to `api-client.ts`**

Append to the END of `apps/web/lib/api-client.ts`:

```ts
// ---------- QA Automation ----------

export type Complexity = "LOW" | "MEDIUM" | "HIGH";
export type AutomationStatus = "ACTIVE" | "MAINTENANCE" | "PAUSED" | "DONE";

export interface TestLine {
  id: string;
  externalId: string | null;
  name: string;
  complexity: Complexity;
  projectId: string;
  _count?: { assignments: number };
}

export interface AutomationAssignment {
  id: string;
  testerId: string;
  testLineId: string;
  startDate: string;
  endDate: string | null;
  status: AutomationStatus;
  notes: string | null;
  testLine?: { id: string; name: string };
  tester?: { id: string; name: string };
  _count?: { records: number };
}

export interface AutomationRecord {
  date: string;
  scriptsCreated: number;
  scriptsRefactored: number;
  scriptsFixed: number;
  execTotal: number;
  execPassed: number;
  execFailed: number;
  notes: string | null;
}

export interface AutomationWeekAssignment {
  id: string;
  testLine: { id: string; name: string; externalId: string | null };
  status: AutomationStatus;
  startDate: string;
  endDate: string | null;
  activeOnDates: string[];
  records: AutomationRecord[];
}

export interface AutomationWeekResponse {
  weekStart: string;
  days: { date: string; isHoliday: boolean; holidayName: string | null; isFuture: boolean }[];
  assignments: AutomationWeekAssignment[];
}

export interface AutomationBulkEntry {
  assignmentId: string;
  date: string;
  scriptsCreated: number;
  scriptsRefactored: number;
  scriptsFixed: number;
  execTotal: number;
  execPassed: number;
  execFailed: number;
  notes?: string | null;
}

export const automationTestLinesApi = {
  list: (projectId: string) =>
    apiClient<TestLine[]>(`/api/test-lines?projectId=${projectId}`),
  get: (id: string) => apiClient<TestLine>(`/api/test-lines/${id}`),
  create: (data: { projectId: string; name: string; complexity?: Complexity; externalId?: string | null }) =>
    apiClient<TestLine>("/api/test-lines", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; complexity: Complexity; externalId: string | null }>) =>
    apiClient<TestLine>(`/api/test-lines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => apiClient<void>(`/api/test-lines/${id}`, { method: "DELETE" }),
};

export const automationAssignmentsApi = {
  byTestLine: (testLineId: string) =>
    apiClient<AutomationAssignment[]>(`/api/automation-assignments?testLineId=${testLineId}`),
  byTester: (testerId: string) =>
    apiClient<AutomationAssignment[]>(`/api/automation-assignments?testerId=${testerId}`),
  create: (data: { testerId: string; testLineId: string; startDate: string; endDate?: string | null; status?: AutomationStatus; notes?: string | null }) =>
    apiClient<AutomationAssignment>("/api/automation-assignments", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ status: AutomationStatus; startDate: string; endDate: string | null; notes: string | null }>) =>
    apiClient<AutomationAssignment>(`/api/automation-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => apiClient<void>(`/api/automation-assignments/${id}`, { method: "DELETE" }),
};

export const automationRecordsApi = {
  week: (testerId: string, weekStart: string) =>
    apiClient<AutomationWeekResponse>(`/api/automation-records?testerId=${testerId}&weekStart=${weekStart}`),
  bulk: (testerId: string, entries: AutomationBulkEntry[]) =>
    apiClient<{ ok: boolean; updated: number }>("/api/automation-records/bulk", {
      method: "POST",
      body: JSON.stringify({ testerId, entries }),
    }),
};
```

- [ ] **Step 2: Register the resources in `permissions.ts`**

In `apps/web/lib/permissions.ts`:

In `RESOURCES`, add after `"phases",`:

```ts
  "test-lines",
  "automation-assignments",
```

In `RESOURCE_LABELS`, add:

```ts
  "test-lines": "Líneas de Prueba (Automatización)",
  "automation-assignments": "Asignaciones de Automatización",
```

In `RESOURCE_GROUPS`, add a new group object after the "Gestión" group:

```ts
  { title: "QA Automation", resources: ["test-lines", "automation-assignments"] },
```

- [ ] **Step 3: Typecheck**

Run (from repo root):

```
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no new errors referencing `api-client.ts` or `permissions.ts`. (Pre-existing errors elsewhere, if any, are out of scope — only confirm your two files are clean.)

- [ ] **Step 4: Commit**

```
git add apps/web/lib/api-client.ts apps/web/lib/permissions.ts
git commit -m "feat(web): api-client + permissions for automation track" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Test Lines CRUD pages

A test line belongs to an AUTOMATION project. The list page needs a project selector (mirror how `mi-semana` lets the user pick among their projects, but here scoped to AUTOMATION projects). For ADMIN/QA_LEAD, the project list comes from `/api/projects` filtered to `modality === "AUTOMATION"`.

**Files:**
- Create: `apps/web/app/(app)/automation/test-lines/page.tsx`
- Create: `apps/web/app/(app)/automation/test-lines/new/page.tsx`
- Create: `apps/web/app/(app)/automation/test-lines/[id]/edit/page.tsx`

- [ ] **Step 1: Create the list page** `apps/web/app/(app)/automation/test-lines/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient, automationTestLinesApi, type TestLine } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
}

const COMPLEXITY_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };

export default function TestLinesPage() {
  const { can } = usePermissions();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [lines, setLines] = useState<TestLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestLine | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiClient<ProjectLite[]>("/api/projects")
      .then((rows) => {
        const autos = rows.filter((p) => p.modality === "AUTOMATION");
        setProjects(autos);
        if (autos.length === 1) setProjectId(autos[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  const fetchLines = useCallback(async (pid: string) => {
    if (!pid) { setLines([]); return; }
    setLoading(true);
    try {
      setLines(await automationTestLinesApi.list(pid));
    } catch {
      setLines([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLines(projectId); }, [projectId, fetchLines]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await automationTestLinesApi.remove(deleteTarget.id);
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchLines(projectId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Líneas de Prueba</h1>
          <p className="text-xs text-gray-400 mt-0.5">{lines.length} en el proyecto seleccionado</p>
        </div>
        {can("test-lines", "create") && projectId && (
          <Link
            href={`/automation/test-lines/new?projectId=${projectId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition-all duration-200 uppercase tracking-wider shadow-sm hover:shadow-md"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva Línea
          </Link>
        )}
      </div>

      <div className="mb-5">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">— Seleccionar proyecto de automatización —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.client.name} · {p.name}</option>
          ))}
        </select>
      </div>

      {!projectId ? (
        <div className="text-center py-20 text-sm text-gray-400">Selecciona un proyecto para ver sus líneas de prueba.</div>
      ) : loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />)}</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-400">No hay líneas de prueba en este proyecto.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">ID Externo</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Complejidad</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Asignaciones</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors duration-150">
                  <td className="px-5 py-3.5 font-medium text-sm text-gray-900">{line.name}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">{line.externalId ?? "—"}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700">{COMPLEXITY_LABEL[line.complexity] ?? line.complexity}</td>
                  <td className="px-5 py-3.5 font-mono text-sm text-gray-700">{line._count?.assignments ?? 0}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {can("test-lines", "update") && (
                        <Link href={`/automation/test-lines/${line.id}/edit`} className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition-all duration-150 font-medium">Editar</Link>
                      )}
                      {can("test-lines", "delete") && (
                        <button onClick={() => setDeleteTarget(line)} className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-150 font-medium">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Línea de Prueba"
        message={`Se eliminará "${deleteTarget?.name}" y sus asignaciones/registros permanentemente.`}
        loading={deleting}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the "new" page** `apps/web/app/(app)/automation/test-lines/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { automationTestLinesApi, type Complexity } from "@/lib/api-client";

export default function NewTestLinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Falta el proyecto (vuelve a la lista y selecciónalo)"); return; }
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await automationTestLinesApi.create({
        projectId,
        name: name.trim(),
        complexity,
        externalId: externalId.trim() || null,
      });
      router.push("/automation/test-lines");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nueva Línea de Prueba</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Ej. Regresión Checkout" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">ID Externo (opcional)</label>
          <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Ej. SUITE-123" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Complejidad</label>
          <select value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
          </select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/automation/test-lines")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Crear Línea"}</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create the "edit" page** `apps/web/app/(app)/automation/test-lines/[id]/edit/page.tsx` (note `use(params)` — Next 16):

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { automationTestLinesApi, type Complexity } from "@/lib/api-client";

export default function EditTestLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("MEDIUM");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    automationTestLinesApi.get(id)
      .then((line) => {
        setName(line.name);
        setExternalId(line.externalId ?? "");
        setComplexity(line.complexity);
      })
      .catch((err: any) => setError(err.message || "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await automationTestLinesApi.update(id, { name: name.trim(), complexity, externalId: externalId.trim() || null });
      router.push("/automation/test-lines");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando…</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Editar Línea de Prueba</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">ID Externo (opcional)</label>
          <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Complejidad</label>
          <select value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
          </select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/automation/test-lines")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Ensure the web dev server is running (`npm run dev --workspace @qa-metrics/web`, serves :3000) and the API is up. Log in as `admin@qametrics.com` / `QaMetrics2024!`, navigate to `/automation/test-lines`, select "Automatización Core Bancario". Verify:
- "Regresión Checkout" appears in the list.
- "Nueva Línea" creates one (it shows after redirect).
- "Editar" loads + saves a name change.
- "Eliminar" removes a line (use a throwaway one).

Confirm no console errors. (If the web app isn't running, start it; if you can't, report the manual steps as pending and proceed.)

- [ ] **Step 5: Commit**

```
git add "apps/web/app/(app)/automation/test-lines"
git commit -m "feat(web): test lines CRUD pages" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Automation weekly registration grid + self-service page

The grid mirrors the manual `WeeklyGrid` mechanics (draft map → dirty detection → bulk POST) but with six numeric fields per cell and no manual status-mismatch logic. It renders one row per active automation assignment (test line), with a compact 2×3 input block (scripts: created/refactored/fixed; executions: total/passed/failed) per weekday.

**Files:**
- Create: `apps/web/components/automation/AutomationWeeklyGrid.tsx`
- Create: `apps/web/app/(app)/automation/registro-semanal/page.tsx`
- Modify: `apps/web/app/(app)/mi-semana/page.tsx`

- [ ] **Step 1: Create the grid component** `apps/web/components/automation/AutomationWeeklyGrid.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  automationRecordsApi,
  type AutomationWeekResponse,
  type AutomationBulkEntry,
} from "@/lib/api-client";

type Field =
  | "scriptsCreated" | "scriptsRefactored" | "scriptsFixed"
  | "execTotal" | "execPassed" | "execFailed";

const NUM_FIELDS: Field[] = [
  "scriptsCreated", "scriptsRefactored", "scriptsFixed",
  "execTotal", "execPassed", "execFailed",
];

const FIELD_LABEL: Record<Field, string> = {
  scriptsCreated: "Creados",
  scriptsRefactored: "Refactor",
  scriptsFixed: "Corregidos",
  execTotal: "Ejec.",
  execPassed: "Pasaron",
  execFailed: "Fallaron",
};

type CellValue = Record<Field, number> & { notes: string | null };
type DraftMap = Record<string, Record<string, CellValue>>; // assignmentId -> date -> cell

function emptyCell(): CellValue {
  return { scriptsCreated: 0, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0, notes: null };
}

function buildDraft(data: AutomationWeekResponse): DraftMap {
  const draft: DraftMap = {};
  for (const a of data.assignments) {
    draft[a.id] = {};
    for (const day of data.days) {
      const rec = a.records.find((r) => r.date === day.date);
      draft[a.id][day.date] = rec
        ? { scriptsCreated: rec.scriptsCreated, scriptsRefactored: rec.scriptsRefactored, scriptsFixed: rec.scriptsFixed, execTotal: rec.execTotal, execPassed: rec.execPassed, execFailed: rec.execFailed, notes: rec.notes }
        : emptyCell();
    }
  }
  return draft;
}

function cellEquals(a: CellValue, b: CellValue): boolean {
  return NUM_FIELDS.every((f) => a[f] === b[f]) && (a.notes ?? "") === (b.notes ?? "");
}

function cellIsEmpty(c: CellValue): boolean {
  return NUM_FIELDS.every((f) => c[f] === 0) && !c.notes;
}

export function AutomationWeeklyGrid({ testerId, weekStart }: { testerId: string; weekStart: Date }) {
  const [data, setData] = useState<AutomationWeekResponse | null>(null);
  const [draft, setDraft] = useState<DraftMap>({});
  const [initial, setInitial] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ assignmentId: string; date: string } | null>(null);

  const mondayStr = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await automationRecordsApi.week(testerId, mondayStr);
      setData(res);
      const d = buildDraft(res);
      setDraft(d);
      setInitial(JSON.parse(JSON.stringify(d)));
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar");
      setData(null);
    }
    setLoading(false);
  }, [testerId, mondayStr]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => {
    for (const aId of Object.keys(draft)) {
      for (const date of Object.keys(draft[aId] ?? {})) {
        const cur = draft[aId][date];
        const init = initial[aId]?.[date] ?? emptyCell();
        if (!cellEquals(cur, init)) return true;
      }
    }
    return false;
  }, [draft, initial]);

  const setCell = (assignmentId: string, date: string, field: Field, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [date]: { ...prev[assignmentId][date], [field]: Math.max(0, value || 0) },
      },
    }));
  };

  const setNote = (assignmentId: string, date: string, notes: string) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [date]: { ...prev[assignmentId][date], notes: notes || null },
      },
    }));
  };

  const persist = async () => {
    if (!data) return;
    // Client-side guard mirroring the backend rule.
    for (const a of data.assignments) {
      for (const day of data.days) {
        const c = draft[a.id]?.[day.date];
        if (c && c.execPassed + c.execFailed > c.execTotal) {
          setError(`En ${day.date}: pasaron+fallaron excede el total de ejecuciones.`);
          return;
        }
      }
    }
    const entries: AutomationBulkEntry[] = [];
    for (const a of data.assignments) {
      for (const day of data.days) {
        const cur = draft[a.id]?.[day.date];
        const init = initial[a.id]?.[day.date] ?? emptyCell();
        if (!cur) continue;
        if (cellEquals(cur, init)) continue;        // unchanged
        if (cellIsEmpty(cur) && !init) continue;     // never had data, still empty
        entries.push({
          assignmentId: a.id,
          date: day.date,
          scriptsCreated: cur.scriptsCreated,
          scriptsRefactored: cur.scriptsRefactored,
          scriptsFixed: cur.scriptsFixed,
          execTotal: cur.execTotal,
          execPassed: cur.execPassed,
          execFailed: cur.execFailed,
          notes: cur.notes,
        });
      }
    }
    if (entries.length === 0) return;
    setSaving(true); setError(null);
    try {
      await automationRecordsApi.bulk(testerId, entries);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando semana…</div>;
  if (error && !data) return <div className="p-6 text-sm text-danger">Error: {error}</div>;
  if (!data) return null;
  if (data.assignments.length === 0) {
    return <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center text-sm text-gray-500">No tienes líneas de prueba activas esta semana.</div>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Línea de prueba</th>
              {data.days.map((d) => (
                <th key={d.date} className={`px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider ${d.isHoliday ? "text-amber-600 bg-amber-50" : "text-gray-400"}`}>
                  {format(new Date(d.date + "T00:00:00"), "EEE dd", { locale: es })}
                  {d.isHoliday && <div className="text-[9px] normal-case">{d.holidayName}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.assignments.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 align-top">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 min-w-[180px]">
                  {a.testLine.name}
                  <div className="text-[10px] text-gray-400">{a.status}</div>
                </td>
                {data.days.map((d) => {
                  const active = a.activeOnDates.includes(d.date);
                  const disabled = !active || d.isHoliday || d.isFuture;
                  const cell = draft[a.id]?.[d.date] ?? emptyCell();
                  return (
                    <td key={d.date} className={`px-2 py-1.5 ${disabled ? "bg-gray-50/60" : ""}`}>
                      <div className="grid grid-cols-3 gap-1">
                        {NUM_FIELDS.map((f) => (
                          <label key={f} className="flex flex-col items-center">
                            <span className="text-[8px] text-gray-400 uppercase">{FIELD_LABEL[f]}</span>
                            <input
                              type="number"
                              min={0}
                              disabled={disabled}
                              value={cell[f] === 0 ? "" : cell[f]}
                              onChange={(e) => setCell(a.id, d.date, f, parseInt(e.target.value, 10))}
                              className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-[#1F3864] focus:outline-none disabled:bg-transparent disabled:text-gray-300"
                            />
                          </label>
                        ))}
                      </div>
                      {!disabled && (
                        <button onClick={() => setNoteFor({ assignmentId: a.id, date: d.date })} className="mt-1 text-[9px] text-[#2E5FA3] hover:underline">
                          {cell.notes ? "✎ nota" : "+ nota"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={persist}
          disabled={!dirty || saving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {dirty && <span className="text-xs text-amber-600">Hay cambios sin guardar</span>}
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNoteFor(null)}>
          <div className="w-[28rem] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-sm font-bold text-[#1F3864]">Nota del día</h3>
            <textarea
              autoFocus
              maxLength={2000}
              value={draft[noteFor.assignmentId]?.[noteFor.date]?.notes ?? ""}
              onChange={(e) => setNote(noteFor.assignmentId, noteFor.date, e.target.value)}
              className="h-32 w-full rounded-lg border border-border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <div className="mt-3 flex justify-end">
              <button onClick={() => setNoteFor(null)} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the self-service page** `apps/web/app/(app)/automation/registro-semanal/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { AutomationWeeklyGrid } from "@/components/automation/AutomationWeeklyGrid";

interface TesterProfile {
  id: string;
  projectId: string;
  name: string;
  allocation: number;
  project: { id: string; name: string; modality: string; client: { name: string } };
}

export default function RegistroSemanalAutomationPage() {
  const [testers, setTesters] = useState<TesterProfile[]>([]);
  const [selectedTesterId, setSelectedTesterId] = useState<string | null>(null);
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient<TesterProfile[]>("/api/testers/me")
      .then((rows) => {
        const autos = rows.filter((t) => t.project.modality === "AUTOMATION");
        setTesters(autos);
        if (autos.length === 1) setSelectedTesterId(autos[0].id);
        setLoaded(true);
      })
      .catch((e: any) => { setError(e?.message ?? "Error"); setLoaded(true); });
  }, []);

  const tester = testers.find((t) => t.id === selectedTesterId) ?? null;

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!loaded) return <div className="p-6 text-sm text-gray-400">Cargando…</div>;
  if (testers.length === 0) {
    return <div className="p-6 text-sm text-gray-500">No estás asignado como automatizador a ningún proyecto de automatización.</div>;
  }

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Registro semanal · Automatización</h1>
        {testers.length > 1 ? (
          <select
            value={selectedTesterId ?? ""}
            onChange={(e) => setSelectedTesterId(e.target.value || null)}
            className={`rounded border p-1.5 text-sm font-medium ${selectedTesterId ? "" : "border-amber-400 bg-amber-50 text-amber-900"}`}
          >
            <option value="">— Seleccionar proyecto —</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>{t.project.client.name} · {t.project.name}</option>
            ))}
          </select>
        ) : tester ? (
          <span className="text-sm text-gray-600">· {tester.project.client.name} · {tester.project.name}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeek((w) => subWeeks(w, 1))} className="rounded border px-3 py-1">←</button>
          <span className="min-w-[180px] text-center font-medium">Semana del {format(week, "d 'de' MMM yyyy", { locale: es })}</span>
          <button onClick={() => setWeek((w) => addWeeks(w, 1))} className="rounded border px-3 py-1">→</button>
        </div>
      </header>

      {tester ? (
        <AutomationWeeklyGrid testerId={tester.id} weekStart={week} />
      ) : (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center text-sm text-amber-900">
          Selecciona un proyecto para registrar tu semana.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Exclude automation testers from the manual `mi-semana`**

In `apps/web/app/(app)/mi-semana/page.tsx`, update the `/me` fetch so the manual grid never shows automation projects. Replace the `.then((rows) => { ... })` body (lines ~34-40) with:

```tsx
      .then((rows) => {
        const manual = rows.filter((t) => t.project.modality !== "AUTOMATION");
        setTesters(manual);
        if (manual.length === 1) setSelectedTesterId(manual[0].id);
      })
```

…and add `modality: string;` to the `TesterProfile` interface's `project` type at the top of the file:

```tsx
  project: { id: string; name: string; modality: string; client: { name: string } };
```

- [ ] **Step 4: Verify in the browser**

With API + web dev server running, log in as the automation engineer `auto.engineer@qametrics.com` / `Analyst2024!`. Navigate to `/automation/registro-semanal`. Verify:
- The page auto-selects the automation project (single tester) and shows the grid with the "Regresión Checkout" row.
- Navigate weeks with ←/→; the seeded weeks (last 5) show existing values.
- Edit a few cells in the current week, "Guardar cambios" persists (reload the page → values stick).
- A row where `execPassed + execFailed > execTotal` shows the client-side error and does NOT save.
- Future days / holidays / out-of-range days are disabled.
- Log in as `admin@qametrics.com` and confirm `/mi-semana` does NOT list the automation project.

Confirm no console errors. (If the web app can't be run in this environment, report manual verification as pending and proceed.)

- [ ] **Step 5: Commit**

```
git add "apps/web/components/automation" "apps/web/app/(app)/automation/registro-semanal" "apps/web/app/(app)/mi-semana/page.tsx"
git commit -m "feat(web): automation weekly registration grid (self-service)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Sidebar navigation

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read the current Sidebar to locate the analyst branch and the ADMIN/QA_LEAD section assembly**

Open `apps/web/components/layout/Sidebar.tsx`. Identify: (a) the `isAnalyst` branch that builds the analyst's `work` items array (where "Mi semana" is pushed), and (b) the ADMIN/QA_LEAD `else` branch that pushes `sections`. Note the icon SVG constants defined at the top (e.g. `iconClipboard`, `iconCalendar`, or similar — reuse an existing one).

- [ ] **Step 2: Add the analyst self-service entry**

In the `isAnalyst` branch, near where "Mi semana" (`/mi-semana`) is added to the analyst's items array, add an automation registration entry. Use an existing icon constant (pick a calendar/clipboard icon already declared in the file):

```ts
// after the "Mi semana" push in the analyst branch:
work.push({ label: "Registro Automatización", href: "/automation/registro-semanal", icon: iconCalendar });
```

(Replace `work` with the actual array name used in that branch, and `iconCalendar` with an existing icon constant.)

- [ ] **Step 3: Add the ADMIN/QA_LEAD automation management section**

In the `else` (ADMIN/QA_LEAD) branch, after the existing sections are assembled, add a permission-gated "QA Automation" section:

```ts
const automationItems: NavItem[] = [];
if (can("test-lines", "read"))
  automationItems.push({ label: "Líneas de Prueba", href: "/automation/test-lines", icon: iconClipboard });
if (can("automation-assignments", "read"))
  automationItems.push({ label: "Registro Automatización", href: "/automation/registro-semanal", icon: iconCalendar });
if (automationItems.length > 0)
  sections.push({ key: "automation", title: "QA Automation", items: automationItems });
```

(Use the actual `NavItem`/`Section` types and `sections` variable name from the file, and existing icon constants. If the file uses inline objects instead of a typed `NavItem[]`, match that style.)

- [ ] **Step 4: Verify**

In the browser: as `admin@qametrics.com`, confirm the sidebar shows a "QA Automation" group with "Líneas de Prueba" and "Registro Automatización", both navigating correctly and highlighting as active. As `auto.engineer@qametrics.com`, confirm "Registro Automatización" appears in their nav.

- [ ] **Step 5: Commit**

```
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): sidebar entries for QA automation" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Whole-UI typecheck/build gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole web app**

Run:

```
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no errors in any of the new/modified files (`automation/**`, `AutomationWeeklyGrid.tsx`, `api-client.ts`, `permissions.ts`, `mi-semana/page.tsx`, `Sidebar.tsx`). Fix any that appear.

- [ ] **Step 2 (optional but recommended): Production build**

If the environment allows (it's slow), run:

```
npm run build --workspace @qa-metrics/web
```

Expected: build succeeds. If it fails on PRE-EXISTING errors unrelated to automation files, note them and confirm the automation files compile; do not fix unrelated breakage.

- [ ] **Step 3: Commit (only if any fixes were made)**

```
git add -A
git commit -m "fix(web): typecheck fixes for automation UI" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Test Lines CRUD → Task 3 (list + new + edit), api in Task 2. ✓
- Self-service weekly registration of scripts + executions → Task 4 (grid + page), `modality` plumbing + seed user in Task 1. ✓
- Plumbing (api-client, permissions, sidebar) → Tasks 2 + 5. ✓
- Permission gating uses the real seeded resources `test-lines` / `automation-assignments` (not invented names) → Tasks 2, 3, 5. ✓
- Manual `mi-semana` no longer shows automation testers → Task 4 Step 3. ✓
- Dashboard intentionally deferred (stated in scope). ✓

**2. Placeholder scan:** All page/component steps contain complete code. The Sidebar task (Task 5) is the only one with "match the actual variable/icon names" instructions rather than a full file rewrite — this is deliberate because the Sidebar's internal structure (icon constant names, array names per role branch) must be read at implementation time; the exact insertion snippets and their placement are specified. No `TBD`/`implement later`.

**3. Type consistency:** Field names match the backend exactly (`scriptsCreated`/`scriptsRefactored`/`scriptsFixed`/`execTotal`/`execPassed`/`execFailed`). `AutomationStatus` values `ACTIVE|MAINTENANCE|PAUSED|DONE`. `TestLine`/`AutomationWeekResponse` shapes match the routes from Plan 1. `automationTestLinesApi.update` uses `PUT` (matches the route). `automationRecordsApi.week`/`bulk` paths and payload (`{ testerId, entries }`) match `automation-records.routes.ts`. The `use(params)` Promise pattern matches Next 16 + the repo's existing `[id]/edit` pages.

**Known constraints surfaced (not gaps):**
- Frontend verification is manual/browser-based (the repo has no per-page unit tests for these flows; Playwright e2e exists but writing new e2e specs is out of scope for this plan). Each UI task includes explicit browser verification steps.
- The 6-inputs-per-cell grid is dense; acceptable for v1 and consistent with mirroring the manual grid. A more compact UX can follow.
