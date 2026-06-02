# QA Automation Track — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parallel "QA Automation" track so an automation engineer's work — script creation/refactor/fix and suite executions (pass/fail) — can be registered and measured against a **Test Line** (suite), not a User Story.

**Architecture:** Mirror the existing manual hierarchy with sibling tables instead of overloading it. New `Modality.AUTOMATION`, new `TestLine` (the unit, equivalent to `UserStory`), `AutomationAssignment` (tester ↔ test line, equivalent to `TesterAssignment`), and `AutomationRecord` (daily counters, equivalent to `DailyRecord` but with automation metrics). The manual track (`UserStory → TestCycle → TesterAssignment → DailyRecord`) is left completely untouched, so existing dashboards/PPTX/occupation keep working. Hours stay in the existing `Activity` model (one optional `testLineId` column added) so FlowPilot keeps feeding occupation unchanged.

**Tech Stack:** TypeScript, Express, Prisma 7 (PostgreSQL), Zod, Vitest (integration tests hit a running API via `fetch` against a seeded dev DB).

**Scope note:** This plan covers ONLY the backend foundation (schema, permissions, CRUD, record loading, metrics service). Two follow-up plans depend on this one:
- *Plan 2 — Web UI* (test-lines management page, weekly automation grid, dashboard cards).
- *Plan 3 — Reports & FlowPilot* (PPTX branching by modality, automation FlowPilot task categories).

---

## File Structure

**Create:**
- `apps/api/src/validators/test-line.validator.ts` — Zod schemas for test lines.
- `apps/api/src/validators/automation-assignment.validator.ts` — Zod schemas for automation assignments.
- `apps/api/src/validators/automation-record.validator.ts` — Zod schema for bulk automation records.
- `apps/api/src/routes/test-lines.routes.ts` — CRUD for `TestLine`.
- `apps/api/src/routes/automation-assignments.routes.ts` — CRUD for `AutomationAssignment`.
- `apps/api/src/routes/automation-records.routes.ts` — weekly GET + bulk upsert (mirror of `daily-records.routes.ts`).
- `apps/api/src/services/automation-metrics.service.ts` — weekly aggregation + pass-rate helpers.
- `apps/api/src/lib/automation-states.ts` — `AutomationStatus` constants/types.
- `apps/api/src/__tests__/automation-metrics.service.test.ts` — pure unit test (no server).
- `apps/api/src/__tests__/test-lines.test.ts` — integration test.
- `apps/api/src/__tests__/automation-assignments.test.ts` — integration test.
- `apps/api/src/__tests__/automation-records.test.ts` — integration test.
- `packages/database/prisma/migrations/<timestamp>_automation_permissions/migration.sql` — hand-written, idempotent permissions migration.

**Modify:**
- `packages/database/prisma/schema.prisma` — add `AUTOMATION` to `Modality`, new models + enum, back-relations on `Project`/`Tester`/`Activity`.
- `apps/api/src/index.ts` — register 3 new routers.
- `packages/database/prisma/seed.ts` — add automation resources to permission list + automation fixtures for tests.

---

## Task 1: Schema — add automation models + AUTOMATION modality

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add `AUTOMATION` to the `Modality` enum**

In `packages/database/prisma/schema.prisma`, replace the `Modality` enum (currently `schema.prisma:216-219`):

```prisma
enum Modality {
  AZURE_DEVOPS
  MANUAL
  AUTOMATION
}
```

- [ ] **Step 2: Add the `AutomationStatus` enum**

Add immediately after the `AssignmentStatus` enum block:

```prisma
enum AutomationStatus {
  ACTIVE        // building / extending the suite
  MAINTENANCE   // only refactor / fixes
  PAUSED
  DONE
}
```

- [ ] **Step 3: Add `TestLine`, `AutomationAssignment`, `AutomationRecord` models**

Add at the end of the file (after `FlowpilotSetting`):

```prisma
// ── QA Automation track ──────────────────────────────────────────────
// Sibling hierarchy to UserStory→TestCycle→TesterAssignment→DailyRecord.
// The unit of work is a Test Line (suite), not a User Story.

model TestLine {
  id          String                 @id @default(cuid())
  externalId  String?
  name        String                 // e.g. "Regresión Checkout", "Smoke API Pagos"
  complexity  Complexity             @default(MEDIUM)
  projectId   String
  project     Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignments AutomationAssignment[]
  activities  Activity[]

  @@index([projectId])
}

model AutomationAssignment {
  id         String             @id @default(cuid())
  testerId   String
  tester     Tester             @relation(fields: [testerId], references: [id], onDelete: Cascade)
  testLineId String
  testLine   TestLine           @relation(fields: [testLineId], references: [id], onDelete: Cascade)
  startDate  DateTime
  endDate    DateTime?
  status     AutomationStatus   @default(ACTIVE)
  notes      String?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
  records    AutomationRecord[]

  @@unique([testerId, testLineId])
  @@index([testerId])
  @@index([testLineId])
}

model AutomationRecord {
  id                String               @id @default(cuid())
  testerId          String
  assignmentId      String
  assignment        AutomationAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  date              DateTime             @db.Date
  scriptsCreated    Int                  @default(0)
  scriptsRefactored Int                  @default(0)
  scriptsFixed      Int                  @default(0)
  execTotal         Int                  @default(0)
  execPassed        Int                  @default(0)
  execFailed        Int                  @default(0)
  notes             String?
  source            String               @default("MANUAL")
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  @@unique([assignmentId, date])
  @@index([assignmentId])
  @@index([testerId])
  @@index([date])
}
```

- [ ] **Step 4: Add back-relations on `Project`, `Tester`, and `Activity`**

In `model Project` (after `stories UserStory[]` at `schema.prisma:85`), add:

```prisma
  testLines  TestLine[]
```

In `model Tester` (after `activities Activity[]` at `schema.prisma:101`), add:

```prisma
  automationAssignments AutomationAssignment[]
```

In `model Activity`, add an optional test-line link. Add this field after `assignmentId String?` (`schema.prisma:281`):

```prisma
  testLineId   String?
```

…and this relation after the `assignment` relation line (`schema.prisma:291`):

```prisma
  testLine   TestLine?         @relation(fields: [testLineId], references: [id])
```

…and this index inside the `@@index` block of `Activity` (after `@@index([assignmentId])` at `schema.prisma:296`):

```prisma
  @@index([testLineId])
```

- [ ] **Step 5: Generate the migration + Prisma client**

Run (PowerShell):

```
npm run db:migrate --workspace @qa-metrics/database -- --name automation_track
```

Expected: Prisma creates `packages/database/prisma/migrations/<timestamp>_automation_track/migration.sql` with `ALTER TYPE "Modality" ADD VALUE 'AUTOMATION'`, `CREATE TYPE "AutomationStatus"`, three `CREATE TABLE`s, the `ALTER TABLE "Activity" ADD COLUMN "testLineId"`, indexes, and FKs. Output ends with `Your database is now in sync with your schema` and `Generated Prisma Client`.

- [ ] **Step 6: Verify the client typings compile**

Run:

```
npm run build --workspace @qa-metrics/database
```

Expected: exits 0 (no TS errors). Confirms `prisma.testLine`, `prisma.automationAssignment`, `prisma.automationRecord` exist on the generated client.

- [ ] **Step 7: Commit**

```
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add QA automation track (TestLine, AutomationAssignment, AutomationRecord)"
```

---

## Task 2: Permissions + seed fixtures

The new resources need permissions (mirroring how `stories`/`assignments` are gated) and the integration tests below need seeded automation data. `migrate deploy` does NOT run the seed in prod, so permissions also need a hand-written idempotent migration (the same pattern as `20260602120000_flowpilot_permissions`).

**Files:**
- Create: `packages/database/prisma/migrations/<timestamp>_automation_permissions/migration.sql`
- Modify: `packages/database/prisma/seed.ts`

- [ ] **Step 1: Add automation resources to the seed permission list**

In `seed.ts`, in the `resources` array (`seed.ts:90-102`), add `"test-lines"` and `"automation-assignments"` after `"phases"`:

```ts
    "assignments", "phases",
    "test-lines", "automation-assignments",
    "records",
```

(Note: automation records, like manual `daily-records`, are gated by tester ownership in the route, not by a permission resource — so no `automation-records` permission is needed.)

- [ ] **Step 2: Grant the new resources to QA_LEAD and QA_ANALYST in the seed**

In the `leadResources` array (`seed.ts:118`), add the two resources:

```ts
  const leadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "test-lines", "automation-assignments", "records", "activities", "activity-categories", "reports", "reports-occupation", "reports-stories"];
```

For QA_ANALYST, add read for both in `analystReadResources` (`seed.ts:143`):

```ts
  const analystReadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "test-lines", "automation-assignments", "records", "dashboard", "gantt", "reports", "reports-occupation", "reports-stories", "audit", "holidays"];
```

…and grant create/update on automation-assignments to QA_ANALYST. After the existing `for (const action of ["create", "update"] as const)` block (`seed.ts:147-151`), add `automation-assignments` to that same loop body by editing it to:

```ts
  for (const action of ["create", "update"] as const) {
    await linkRolePermission(qaAnalystRole.id, permissions[`records:${action}`].id);
    await linkRolePermission(qaAnalystRole.id, permissions[`assignments:${action}`].id);
    await linkRolePermission(qaAnalystRole.id, permissions[`phases:${action}`].id);
    await linkRolePermission(qaAnalystRole.id, permissions[`automation-assignments:${action}`].id);
  }
```

Also grant CLIENT_PM read by adding both resources to `clientPmResources` (`seed.ts:165`):

```ts
  const clientPmResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "test-lines", "automation-assignments", "records", "activities", "activity-categories", "dashboard", "gantt", "reports", "reports-occupation", "reports-stories"];
```

- [ ] **Step 3: Add automation fixtures to the seed**

In `seed.ts`, immediately before the final `console.log("Seed completado (idempotente):");` line (`seed.ts:399`), insert the following block. It creates an AUTOMATION project owned by `client1`, links it to `tester1User`, a test line, an assignment, and 5 weekdays of records — exactly what the integration tests query.

```ts
  // ── QA Automation fixtures (for integration tests) ──────────────────
  const autoProject = await ensureProject("Automatización Core Bancario", client1.id, "AUTOMATION" as any);

  async function ensureTestLine(name: string, projectId: string, complexity: "HIGH" | "MEDIUM" | "LOW") {
    const existing = await prisma.testLine.findFirst({ where: { name, projectId } });
    if (existing) return existing;
    return prisma.testLine.create({ data: { name, projectId, complexity } });
  }

  // tester1User is linked to testers1[0] in project1, but automation needs its
  // own Tester row inside the automation project (Tester is per-project).
  async function ensureLinkedTester(name: string, projectId: string, userId: string) {
    let t = await prisma.tester.findFirst({ where: { name, projectId } });
    if (!t) t = await prisma.tester.create({ data: { name, projectId, userId } });
    else if (t.userId !== userId) t = await prisma.tester.update({ where: { id: t.id }, data: { userId } });
    return t;
  }

  const autoTester1 = await ensureLinkedTester("Tester Uno", autoProject.id, tester1User.id);
  const autoTester2 = await ensureLinkedTester("Tester Dos", autoProject.id, tester2User.id);
  const testLine1 = await ensureTestLine("Regresión Checkout", autoProject.id, "HIGH");

  async function ensureAutoAssignment(testerId: string, testLineId: string, start: string, end: string, status: "ACTIVE" | "MAINTENANCE" | "PAUSED" | "DONE") {
    const existing = await prisma.automationAssignment.findUnique({
      where: { testerId_testLineId: { testerId, testLineId } },
    });
    if (existing) return existing;
    return prisma.automationAssignment.create({
      data: { testerId, testLineId, startDate: new Date(start), endDate: new Date(end), status },
    });
  }

  const autoAssign1 = await ensureAutoAssignment(autoTester1.id, testLine1.id, "2026-01-05", "2026-12-31", "ACTIVE");

  for (let w = 4; w >= 0; w--) {
    const monday = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 });
    for (let d = 0; d < 5; d++) {
      const date = addDays(monday, d);
      await prisma.automationRecord.upsert({
        where: { assignmentId_date: { assignmentId: autoAssign1.id, date } },
        update: {},
        create: {
          testerId: autoTester1.id,
          assignmentId: autoAssign1.id,
          date,
          scriptsCreated: d % 3,
          scriptsRefactored: (d + 1) % 2,
          scriptsFixed: d === 4 ? 1 : 0,
          execTotal: 10,
          execPassed: 8 + (d % 3),
          execFailed: 2 - (d % 3),
        },
      });
    }
  }
  // expose for tests via well-known names: autoTester2 has an assignment but no records
  await ensureAutoAssignment(autoTester2.id, testLine1.id, "2026-01-05", "2026-12-31", "MAINTENANCE");
```

- [ ] **Step 4: Write the idempotent permissions migration**

Create `packages/database/prisma/migrations/<timestamp>_automation_permissions/migration.sql` (use a timestamp strictly later than `20260602120000`, e.g. `20260602130000`). The folder name's timestamp must sort after all existing migrations:

```sql
-- Automation track permissions. Idempotent (ON CONFLICT DO NOTHING), safe to re-run.
-- migrate deploy does NOT run the seed, so prod roles need these explicitly.

-- 1) Resources x actions.
INSERT INTO "Permission" (id, resource, action)
SELECT gen_random_uuid()::text, r.resource, a.action
FROM (VALUES ('test-lines'), ('automation-assignments')) AS r(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS a(action)
ON CONFLICT (resource, action) DO NOTHING;

-- 2) ADMIN: full access.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments')
WHERE ro.name = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 3) QA_LEAD: full access to both.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments')
WHERE ro.name = 'QA_LEAD'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4) QA_ANALYST: read both; create/update automation-assignments.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON (
     (p.resource = 'test-lines' AND p.action = 'read')
  OR (p.resource = 'automation-assignments' AND p.action IN ('read', 'create', 'update'))
)
WHERE ro.name = 'QA_ANALYST'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 5) CLIENT_PM: read-only.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments') AND p.action = 'read'
WHERE ro.name = 'CLIENT_PM'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

- [ ] **Step 5: Apply migration + reseed the dev DB**

Run:

```
npm run db:migrate --workspace @qa-metrics/database
npm run db:seed --workspace @qa-metrics/database
```

Expected: migrate reports `automation_permissions` applied; seed prints `Seed completado (idempotente):` with no errors.

- [ ] **Step 6: Commit**

```
git add packages/database/prisma/migrations packages/database/prisma/seed.ts
git commit -m "feat(db): automation permissions + seed fixtures"
```

---

## Task 3: Automation metrics service (pure unit, TDD)

**Files:**
- Create: `apps/api/src/services/automation-metrics.service.ts`
- Test: `apps/api/src/__tests__/automation-metrics.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/automation-metrics.service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  aggregateAutomationDailyToWeekly,
  passRate,
  type AutomationDailyLike,
} from "../services/automation-metrics.service.js";

describe("automation-metrics.service", () => {
  it("buckets daily records into ISO weeks (Mon start) and sums all six counters", () => {
    const records: AutomationDailyLike[] = [
      // Week of 2026-04-06 (Mon) .. 2026-04-10
      { date: new Date("2026-04-06"), scriptsCreated: 2, scriptsRefactored: 1, scriptsFixed: 0, execTotal: 10, execPassed: 9, execFailed: 1 },
      { date: new Date("2026-04-08"), scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 2, execTotal: 5, execPassed: 4, execFailed: 1 },
      // Next week 2026-04-13
      { date: new Date("2026-04-13"), scriptsCreated: 3, scriptsRefactored: 2, scriptsFixed: 1, execTotal: 8, execPassed: 8, execFailed: 0 },
    ];
    const weeks = aggregateAutomationDailyToWeekly(records);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].scriptsCreated).toBe(3);
    expect(weeks[0].scriptsFixed).toBe(2);
    expect(weeks[0].execTotal).toBe(15);
    expect(weeks[0].execPassed).toBe(13);
    expect(weeks[1].scriptsRefactored).toBe(2);
    // weeks sorted ascending by weekStart
    expect(weeks[0].weekStart.getTime()).toBeLessThan(weeks[1].weekStart.getTime());
  });

  it("passRate returns passed/total as a 0..1 fraction, and 0 when total is 0", () => {
    expect(passRate({ execTotal: 10, execPassed: 8 })).toBe(0.8);
    expect(passRate({ execTotal: 0, execPassed: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```
npm test --workspace @qa-metrics/api -- automation-metrics.service
```

Expected: FAIL — cannot resolve `../services/automation-metrics.service.js` (module not found).

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/services/automation-metrics.service.ts`:

```ts
import { startOfWeek } from "date-fns";

export interface AutomationDailyLike {
  date: Date;
  scriptsCreated: number;
  scriptsRefactored: number;
  scriptsFixed: number;
  execTotal: number;
  execPassed: number;
  execFailed: number;
}

export interface AutomationWeekBucket {
  weekStart: Date;
  scriptsCreated: number;
  scriptsRefactored: number;
  scriptsFixed: number;
  execTotal: number;
  execPassed: number;
  execFailed: number;
}

export function aggregateAutomationDailyToWeekly(
  records: AutomationDailyLike[]
): AutomationWeekBucket[] {
  const buckets = new Map<string, AutomationWeekBucket>();
  for (const r of records) {
    const ws = startOfWeek(r.date, { weekStartsOn: 1 });
    const key = ws.toISOString();
    const cur =
      buckets.get(key) ?? {
        weekStart: ws,
        scriptsCreated: 0,
        scriptsRefactored: 0,
        scriptsFixed: 0,
        execTotal: 0,
        execPassed: 0,
        execFailed: 0,
      };
    cur.scriptsCreated += r.scriptsCreated;
    cur.scriptsRefactored += r.scriptsRefactored;
    cur.scriptsFixed += r.scriptsFixed;
    cur.execTotal += r.execTotal;
    cur.execPassed += r.execPassed;
    cur.execFailed += r.execFailed;
    buckets.set(key, cur);
  }
  return [...buckets.values()].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
  );
}

export function passRate(x: { execTotal: number; execPassed: number }): number {
  if (x.execTotal <= 0) return 0;
  return x.execPassed / x.execTotal;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```
npm test --workspace @qa-metrics/api -- automation-metrics.service
```

Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```
git add apps/api/src/services/automation-metrics.service.ts apps/api/src/__tests__/automation-metrics.service.test.ts
git commit -m "feat(api): automation weekly metrics aggregation + passRate"
```

---

## Task 4: Automation status constants

**Files:**
- Create: `apps/api/src/lib/automation-states.ts`

- [ ] **Step 1: Write the file**

Create `apps/api/src/lib/automation-states.ts`:

```ts
export const AUTOMATION_STATUSES = [
  "ACTIVE",
  "MAINTENANCE",
  "PAUSED",
  "DONE",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

// Statuses for which the weekly grid shows the assignment by default.
export const AUTOMATION_OPEN_STATUSES = ["ACTIVE", "MAINTENANCE"] as const;
```

- [ ] **Step 2: Verify it compiles**

Run:

```
npm run build --workspace @qa-metrics/api
```

Expected: exits 0 (or fails only on not-yet-created route imports — if so, that's fine until Task 7; re-run after Task 7). To check just this file in isolation:

```
npx tsc --noEmit apps/api/src/lib/automation-states.ts
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```
git add apps/api/src/lib/automation-states.ts
git commit -m "feat(api): automation status constants"
```

---

## Task 5: Test Lines CRUD route (TDD)

**Files:**
- Create: `apps/api/src/validators/test-line.validator.ts`
- Create: `apps/api/src/routes/test-lines.routes.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/test-lines.test.ts`

- [ ] **Step 1: Write the validator**

Create `apps/api/src/validators/test-line.validator.ts`:

```ts
import { z } from "zod";

export const createTestLineSchema = z.object({
  projectId: z.string().min(1),
  externalId: z.string().optional().nullable(),
  name: z.string().min(1).max(300),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const updateTestLineSchema = createTestLineSchema.partial();
```

- [ ] **Step 2: Write the failing integration test**

Create `apps/api/src/__tests__/test-lines.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getAutoProjectId(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projects = await res.json();
  const auto = projects.find((p: any) => p.modality === "AUTOMATION");
  return auto.id;
}

describe("Test Lines API", () => {
  let adminToken: string;
  let projectId: string;
  let createdId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    projectId = await getAutoProjectId(adminToken);
  });

  it("GET /api/test-lines?projectId= returns the seeded test line", async () => {
    const res = await fetch(`${API_URL}/api/test-lines?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const lines = await res.json();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.some((l: any) => l.name === "Regresión Checkout")).toBe(true);
  });

  it("POST /api/test-lines creates a test line", async () => {
    const res = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId, name: "Smoke API Pagos", complexity: "MEDIUM" }),
    });
    expect(res.status).toBe(201);
    const line = await res.json();
    expect(line.name).toBe("Smoke API Pagos");
    expect(line.projectId).toBe(projectId);
    createdId = line.id;
  });

  it("PUT /api/test-lines/:id updates the name", async () => {
    const res = await fetch(`${API_URL}/api/test-lines/${createdId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Smoke API Pagos v2" }),
    });
    expect(res.status).toBe(200);
    const line = await res.json();
    expect(line.name).toBe("Smoke API Pagos v2");
  });

  it("DELETE /api/test-lines/:id removes it", async () => {
    const res = await fetch(`${API_URL}/api/test-lines/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("POST without name returns 400", async () => {
    const res = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```
npm test --workspace @qa-metrics/api -- test-lines
```

Expected: FAIL — GET returns 404 (route not registered) so `lines.some` throws / status assertion fails.

- [ ] **Step 4: Write the route**

Create `apps/api/src/routes/test-lines.routes.ts` (follows the access pattern of `projects.routes.ts` + `cycles.routes.ts`):

```ts
import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createTestLineSchema, updateTestLineSchema } from "../validators/test-line.validator.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  const where: any = { id: projectId };
  if (isAnalyst(req)) where.testers = { some: { userId: req.user!.id } };
  else where.client = { userId: req.user!.id };
  const project = await prisma.project.findFirst({ where, select: { id: true } });
  return !!project;
}

// GET /?projectId=X — list test lines of a project
router.get("/", requirePermission("test-lines", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId es requerido" });
      return;
    }
    if (!(await userCanAccessProject(req, projectId))) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const lines = await prisma.testLine.findMany({
      where: { projectId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener líneas de prueba" });
  }
});

// POST / — create
router.post("/", requirePermission("test-lines", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createTestLineSchema.parse(req.body);
    if (!(await userCanAccessProject(req, data.projectId))) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const line = await prisma.testLine.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        externalId: data.externalId ?? null,
        ...(data.complexity ? { complexity: data.complexity } : {}),
      },
    });
    res.status(201).json(line);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al crear línea de prueba" });
  }
});

// PUT /:id — update
router.put("/:id", requirePermission("test-lines", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const data = updateTestLineSchema.parse(req.body);
    const existing = await prisma.testLine.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing || !(await userCanAccessProject(req, existing.projectId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    const line = await prisma.testLine.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.complexity !== undefined ? { complexity: data.complexity } : {}),
      },
    });
    res.json(line);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al actualizar línea de prueba" });
  }
});

// DELETE /:id — delete (cascade to assignments/records via Prisma onDelete)
router.delete("/:id", requirePermission("test-lines", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const existing = await prisma.testLine.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing || !(await userCanAccessProject(req, existing.projectId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    await prisma.testLine.delete({ where: { id } });
    res.json({ message: "Línea de prueba eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar línea de prueba" });
  }
});

export default router;
```

- [ ] **Step 5: Register the router in `index.ts`**

In `apps/api/src/index.ts`, add the import after the flowpilot import (`index.ts:30`):

```ts
import testLinesRoutes from "./routes/test-lines.routes.js";
```

…and the mount after the flowpilot mount (`index.ts:88`):

```ts
app.use("/api/test-lines", testLinesRoutes);
```

- [ ] **Step 6: Run the test to verify it passes**

Start the API if not running, then run:

```
npm test --workspace @qa-metrics/api -- test-lines
```

Expected: PASS (5 passed).

- [ ] **Step 7: Commit**

```
git add apps/api/src/validators/test-line.validator.ts apps/api/src/routes/test-lines.routes.ts apps/api/src/index.ts apps/api/src/__tests__/test-lines.test.ts
git commit -m "feat(api): test lines CRUD endpoint"
```

---

## Task 6: Automation Assignments CRUD route (TDD)

**Files:**
- Create: `apps/api/src/validators/automation-assignment.validator.ts`
- Create: `apps/api/src/routes/automation-assignments.routes.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/automation-assignments.test.ts`

- [ ] **Step 1: Write the validator**

Create `apps/api/src/validators/automation-assignment.validator.ts`:

```ts
import { z } from "zod";

const STATUS_VALUES = ["ACTIVE", "MAINTENANCE", "PAUSED", "DONE"] as const;

export const createAutomationAssignmentSchema = z.object({
  testerId: z.string().min(1),
  testLineId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().nullable().optional(),
});

export const updateAutomationAssignmentSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
```

- [ ] **Step 2: Write the failing integration test**

Create `apps/api/src/__tests__/automation-assignments.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

describe("Automation Assignments API", () => {
  let adminToken: string;
  let projectId: string;
  let testLineId: string;
  let testerId: string;
  let createdId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    const projectsRes = await fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const projects = await projectsRes.json();
    const auto = projects.find((p: any) => p.modality === "AUTOMATION");
    projectId = auto.id;
    testerId = auto.testers[0].id;

    const linesRes = await fetch(`${API_URL}/api/test-lines?projectId=${projectId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const lines = await linesRes.json();
    testLineId = lines.find((l: any) => l.name === "Regresión Checkout").id;
  });

  it("GET /api/automation-assignments?testLineId= lists assignments", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments?testLineId=${testLineId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it("POST creates an assignment for a tester that has none yet", async () => {
    // create a fresh test line so the unique [testerId,testLineId] does not clash with seed
    const lineRes = await fetch(`${API_URL}/api/test-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ projectId, name: "Línea temporal asignación" }),
    });
    const freshLine = await lineRes.json();

    const res = await fetch(`${API_URL}/api/automation-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ testerId, testLineId: freshLine.id, startDate: "2026-05-04", status: "ACTIVE" }),
    });
    expect(res.status).toBe(201);
    const a = await res.json();
    expect(a.testerId).toBe(testerId);
    expect(a.status).toBe("ACTIVE");
    createdId = a.id;
  });

  it("PUT updates the status", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments/${createdId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "MAINTENANCE" }),
    });
    expect(res.status).toBe(200);
    const a = await res.json();
    expect(a.status).toBe("MAINTENANCE");
  });

  it("POST with invalid status returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ testerId, testLineId, startDate: "2026-05-04", status: "BOGUS" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```
npm test --workspace @qa-metrics/api -- automation-assignments
```

Expected: FAIL — GET returns 404 (route not registered).

- [ ] **Step 4: Write the route**

Create `apps/api/src/routes/automation-assignments.routes.ts`:

```ts
import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import {
  createAutomationAssignmentSchema,
  updateAutomationAssignmentSchema,
} from "../validators/automation-assignment.validator.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessTestLine(req: AuthRequest, testLineId: string): Promise<boolean> {
  const line = await prisma.testLine.findUnique({ where: { id: testLineId }, select: { projectId: true } });
  if (!line) return false;
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(line.projectId);
  }
  const where: any = { id: line.projectId };
  if (isAnalyst(req)) where.testers = { some: { userId: req.user!.id } };
  else where.client = { userId: req.user!.id };
  const project = await prisma.project.findFirst({ where, select: { id: true } });
  return !!project;
}

// GET /?testLineId=X  OR  ?testerId=X
router.get("/", requirePermission("automation-assignments", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const testLineId = req.query.testLineId as string | undefined;
    const testerId = req.query.testerId as string | undefined;
    if (!testLineId && !testerId) {
      res.status(400).json({ error: "testLineId o testerId es requerido" });
      return;
    }
    if (testLineId && !(await userCanAccessTestLine(req, testLineId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    const list = await prisma.automationAssignment.findMany({
      where: {
        ...(testLineId ? { testLineId } : {}),
        ...(testerId ? { testerId } : {}),
      },
      include: {
        testLine: { select: { id: true, name: true } },
        tester: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener asignaciones de automatización" });
  }
});

// POST /
router.post("/", requirePermission("automation-assignments", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createAutomationAssignmentSchema.parse(req.body);
    if (!(await userCanAccessTestLine(req, data.testLineId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    // tester must belong to the same project as the test line
    const line = await prisma.testLine.findUnique({ where: { id: data.testLineId }, select: { projectId: true } });
    const tester = await prisma.tester.findUnique({ where: { id: data.testerId }, select: { projectId: true } });
    if (!tester || tester.projectId !== line!.projectId) {
      res.status(400).json({ error: "El tester no pertenece al proyecto de la línea de prueba" });
      return;
    }
    const created = await prisma.automationAssignment.create({
      data: {
        testerId: data.testerId,
        testLineId: data.testLineId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status ?? "ACTIVE",
        notes: data.notes ?? null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    // unique [testerId, testLineId] violation
    if ((err as any)?.code === "P2002") { res.status(409).json({ error: "El tester ya está asignado a esta línea" }); return; }
    res.status(500).json({ error: "Error al crear asignación de automatización" });
  }
});

// PUT /:id
router.put("/:id", requirePermission("automation-assignments", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateAutomationAssignmentSchema.parse(req.body);
    const existing = await prisma.automationAssignment.findUnique({ where: { id }, select: { testLineId: true } });
    if (!existing || !(await userCanAccessTestLine(req, existing.testLineId))) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }
    const updated = await prisma.automationAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al actualizar asignación de automatización" });
  }
});

// DELETE /:id
router.delete("/:id", requirePermission("automation-assignments", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const existing = await prisma.automationAssignment.findUnique({ where: { id }, select: { testLineId: true } });
    if (!existing || !(await userCanAccessTestLine(req, existing.testLineId))) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }
    await prisma.automationAssignment.delete({ where: { id } });
    res.json({ message: "Asignación eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar asignación de automatización" });
  }
});

export default router;
```

- [ ] **Step 5: Register the router in `index.ts`**

Add import after the `testLinesRoutes` import:

```ts
import automationAssignmentsRoutes from "./routes/automation-assignments.routes.js";
```

…and the mount after the `/api/test-lines` mount:

```ts
app.use("/api/automation-assignments", automationAssignmentsRoutes);
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```
npm test --workspace @qa-metrics/api -- automation-assignments
```

Expected: PASS (4 passed).

- [ ] **Step 7: Commit**

```
git add apps/api/src/validators/automation-assignment.validator.ts apps/api/src/routes/automation-assignments.routes.ts apps/api/src/index.ts apps/api/src/__tests__/automation-assignments.test.ts
git commit -m "feat(api): automation assignments CRUD endpoint"
```

---

## Task 7: Automation Records weekly load (TDD)

This mirrors `daily-records.routes.ts` — a weekly GET shaped for a grid, plus a `POST /bulk` upsert — but with the six automation counters and the simpler `AutomationStatus` lifecycle (no PRODUCTION 7-day window). Ownership-gated like daily records (no permission resource).

**Files:**
- Create: `apps/api/src/validators/automation-record.validator.ts`
- Create: `apps/api/src/routes/automation-records.routes.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/automation-records.test.ts`

- [ ] **Step 1: Write the validator**

Create `apps/api/src/validators/automation-record.validator.ts`:

```ts
import { z } from "zod";

export const automationBulkSchema = z.object({
  testerId: z.string().cuid(),
  entries: z
    .array(
      z.object({
        assignmentId: z.string().cuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scriptsCreated: z.number().int().min(0),
        scriptsRefactored: z.number().int().min(0),
        scriptsFixed: z.number().int().min(0),
        execTotal: z.number().int().min(0),
        execPassed: z.number().int().min(0),
        execFailed: z.number().int().min(0),
        notes: z.string().max(2000).nullable().optional(),
      })
    )
    .min(1),
});
```

- [ ] **Step 2: Write the failing integration test**

Create `apps/api/src/__tests__/automation-records.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";

async function getMe(token: string) {
  const res = await fetch(`${API_URL}/api/testers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200 ? await res.json() : null;
}

describe("Automation Records API", () => {
  let adminToken: string;
  let tester1Token: string;
  let testerId: string;
  let assignmentId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
    tester1Token = await loginAs("tester1@qametrics.com");

    // Find the automation project + tester1's automation tester row + its assignment
    const projectsRes = await fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const projects = await projectsRes.json();
    const auto = projects.find((p: any) => p.modality === "AUTOMATION");
    // tester "Tester Uno" is linked to tester1@qametrics.com in the seed
    testerId = auto.testers.find((t: any) => t.name === "Tester Uno").id;

    const aRes = await fetch(`${API_URL}/api/automation-assignments?testerId=${testerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await aRes.json();
    assignmentId = assignments[0].id;
  });

  it("GET /api/automation-records returns a 5-weekday shape", async () => {
    const weekStart = "2026-04-06"; // Monday
    const res = await fetch(
      `${API_URL}/api/automation-records?testerId=${testerId}&weekStart=${weekStart}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weekStart).toBe(weekStart);
    expect(data.days).toHaveLength(5);
    expect(data.assignments.length).toBeGreaterThan(0);
  });

  it("POST /api/automation-records/bulk upserts counters", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [
          { assignmentId, date: "2026-04-06", scriptsCreated: 4, scriptsRefactored: 1, scriptsFixed: 0, execTotal: 12, execPassed: 11, execFailed: 1 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const check = await fetch(
      `${API_URL}/api/automation-records?testerId=${testerId}&weekStart=2026-04-06`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const checkData = await check.json();
    const a = checkData.assignments.find((x: any) => x.id === assignmentId);
    const rec = a.records.find((r: any) => r.date === "2026-04-06");
    expect(rec.scriptsCreated).toBe(4);
    expect(rec.execPassed).toBe(11);
  });

  it("POST bulk with a future date returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [{ assignmentId, date: "2099-01-05", scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST bulk on a holiday (2026-05-01) returns 400", async () => {
    const res = await fetch(`${API_URL}/api/automation-records/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        testerId,
        entries: [{ assignmentId, date: "2026-05-01", scriptsCreated: 1, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```
npm test --workspace @qa-metrics/api -- automation-records
```

Expected: FAIL — GET returns 404 (route not registered).

- [ ] **Step 4: Write the route**

Create `apps/api/src/routes/automation-records.routes.ts`:

```ts
import { Router, Response } from "express";
import { z } from "zod";
import { addDays, startOfDay } from "date-fns";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { AUTOMATION_OPEN_STATUSES, type AutomationStatus } from "../lib/automation-states.js";
import { automationBulkSchema } from "../validators/automation-record.validator.js";

const router = Router();
router.use(authMiddleware as any);

async function canActOn(req: AuthRequest, testerId: string): Promise<boolean> {
  const roleName = req.user?.role?.name;
  if (roleName === "ADMIN" || roleName === "QA_LEAD") return true;
  const tester = await prisma.tester.findUnique({ where: { id: testerId } });
  return tester?.userId === req.user?.id;
}

async function canReadTester(req: AuthRequest, testerId: string): Promise<boolean> {
  const roleName = req.user?.role?.name;
  if (roleName === "ADMIN" || roleName === "QA_LEAD") return true;
  const tester = await prisma.tester.findUnique({
    where: { id: testerId },
    select: { userId: true, projectId: true },
  });
  if (!tester) return false;
  if (roleName === "CLIENT_PM") {
    const p = await prisma.project.findFirst({
      where: { id: tester.projectId, projectManagerId: req.user!.id },
      select: { id: true },
    });
    return !!p;
  }
  return tester.userId === req.user?.id;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function enumerateWeekdaysInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = startOfDay(new Date(start));
  const last = startOfDay(new Date(end));
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// GET /?testerId=&weekStart=YYYY-MM-DD
router.get("/", async (req: AuthRequest, res: Response) => {
  const parsed = z
    .object({
      testerId: z.string().cuid(),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!(await canReadTester(req, parsed.data.testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const monday = startOfDay(new Date(parsed.data.weekStart + "T00:00:00"));
  const friday = addDays(monday, 4);
  const today = startOfDay(new Date());

  const holidays = await prisma.holiday.findMany({ where: { date: { gte: monday, lte: friday } } });
  const holidayMap = new Map(holidays.map((h) => [toISODate(h.date), h.name]));
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    const key = toISODate(d);
    days.push({
      date: key,
      isHoliday: holidayMap.has(key),
      holidayName: holidayMap.get(key) ?? null,
      isFuture: d > today,
    });
  }

  const includeIdle = req.query.includeIdle === "true";
  const openStatuses = AUTOMATION_OPEN_STATUSES as readonly AutomationStatus[];

  const assignments = await prisma.automationAssignment.findMany({
    where: {
      testerId: parsed.data.testerId,
      AND: [
        { startDate: { lte: friday } },
        { OR: [{ endDate: null }, { endDate: { gte: monday } }] },
        ...(includeIdle
          ? []
          : [
              {
                OR: [
                  { status: { in: openStatuses as any } },
                  { records: { some: { date: { gte: monday, lte: friday } } } },
                ],
              },
            ]),
      ],
    },
    include: {
      testLine: { select: { id: true, name: true, externalId: true } },
      records: { where: { date: { gte: monday, lte: friday } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = assignments.map((a) => {
    const rangeEnd = a.endDate ?? today;
    const effectiveEnd = rangeEnd < friday ? rangeEnd : friday;
    const effectiveStart = a.startDate > monday ? a.startDate : monday;
    const activeOnDates =
      effectiveEnd < effectiveStart ? [] : enumerateWeekdaysInRange(effectiveStart, effectiveEnd);
    return {
      id: a.id,
      testLine: a.testLine,
      status: a.status,
      startDate: toISODate(a.startDate),
      endDate: a.endDate ? toISODate(a.endDate) : null,
      activeOnDates,
      records: a.records.map((r) => ({
        date: toISODate(r.date),
        scriptsCreated: r.scriptsCreated,
        scriptsRefactored: r.scriptsRefactored,
        scriptsFixed: r.scriptsFixed,
        execTotal: r.execTotal,
        execPassed: r.execPassed,
        execFailed: r.execFailed,
        notes: r.notes ?? null,
      })),
    };
  });

  res.json({ weekStart: parsed.data.weekStart, days, assignments: result });
});

// POST /bulk
router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const parsed = automationBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { testerId, entries } = parsed.data;
  if (!(await canActOn(req, testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // execPassed + execFailed must not exceed execTotal
  for (const e of entries) {
    if (e.execPassed + e.execFailed > e.execTotal) {
      res.status(400).json({ error: `pasados+fallidos exceden el total en ${e.date}` });
      return;
    }
  }

  const today = startOfDay(new Date());
  const dates = entries.map((e) => new Date(e.date + "T00:00:00"));
  if (dates.some((d) => d > today)) {
    res.status(400).json({ error: "no se permiten fechas futuras" });
    return;
  }

  const holidays = await prisma.holiday.findMany({ where: { date: { in: dates } } });
  if (holidays.length > 0) {
    res.status(400).json({ error: "no se permite cargar feriados", holidays });
    return;
  }

  const assignmentIds = [...new Set(entries.map((e) => e.assignmentId))];
  const assignments = await prisma.automationAssignment.findMany({
    where: { id: { in: assignmentIds } },
    select: { id: true, testerId: true, startDate: true, endDate: true },
  });
  const aMap = new Map(assignments.map((a) => [a.id, a]));
  for (const e of entries) {
    const a = aMap.get(e.assignmentId);
    if (!a) { res.status(400).json({ error: `asignación inválida: ${e.assignmentId}` }); return; }
    if (a.testerId !== testerId) { res.status(403).json({ error: "asignación no pertenece al tester" }); return; }
    const d = new Date(e.date + "T00:00:00");
    const start = startOfDay(a.startDate);
    const end = a.endDate ? startOfDay(a.endDate) : today;
    if (d < start || d > end) {
      res.status(400).json({ error: `fecha ${e.date} fuera del rango de la asignación` });
      return;
    }
  }

  await prisma.$transaction(
    entries.map((e) =>
      prisma.automationRecord.upsert({
        where: { assignmentId_date: { assignmentId: e.assignmentId, date: new Date(e.date + "T00:00:00") } },
        create: {
          testerId,
          assignmentId: e.assignmentId,
          date: new Date(e.date + "T00:00:00"),
          scriptsCreated: e.scriptsCreated,
          scriptsRefactored: e.scriptsRefactored,
          scriptsFixed: e.scriptsFixed,
          execTotal: e.execTotal,
          execPassed: e.execPassed,
          execFailed: e.execFailed,
          notes: e.notes ?? null,
        },
        update: {
          scriptsCreated: e.scriptsCreated,
          scriptsRefactored: e.scriptsRefactored,
          scriptsFixed: e.scriptsFixed,
          execTotal: e.execTotal,
          execPassed: e.execPassed,
          execFailed: e.execFailed,
          ...(e.notes !== undefined ? { notes: e.notes } : {}),
        },
      })
    )
  );
  res.json({ ok: true, updated: entries.length });
});

export default router;
```

- [ ] **Step 5: Register the router in `index.ts`**

Add import after `automationAssignmentsRoutes`:

```ts
import automationRecordsRoutes from "./routes/automation-records.routes.js";
```

…and the mount after `/api/automation-assignments`:

```ts
app.use("/api/automation-records", automationRecordsRoutes);
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```
npm test --workspace @qa-metrics/api -- automation-records
```

Expected: PASS (4 passed).

- [ ] **Step 7: Run the full API test suite + build to confirm no regressions**

Run:

```
npm run build --workspace @qa-metrics/api
npm test --workspace @qa-metrics/api
```

Expected: build exits 0; all tests pass (the new specs plus all pre-existing manual-track tests untouched).

- [ ] **Step 8: Commit**

```
git add apps/api/src/validators/automation-record.validator.ts apps/api/src/routes/automation-records.routes.ts apps/api/src/index.ts apps/api/src/__tests__/automation-records.test.ts
git commit -m "feat(api): automation records weekly load + bulk upsert"
```

---

## Self-Review

**1. Spec coverage:**
- Unit = Test Line → `TestLine` model + CRUD (Tasks 1, 5). ✓
- Productivity = scripts created/refactored/fixed → `AutomationRecord` counters + metrics service (Tasks 1, 3, 7). ✓
- Executions (pass/fail) → `execTotal/execPassed/execFailed` + `passRate` + validation that passed+failed ≤ total (Tasks 1, 3, 7). ✓
- Registration = both counters AND FlowPilot hours → counters delivered here (Task 7); hours hook is `Activity.testLineId` added in Task 1, with FlowPilot task categories deferred to Plan 3 (noted in scope). ✓ (partial by design)
- Manual track untouched / no regression → sibling tables, full API suite run in Task 7 Step 7. ✓
- AUTOMATION modality exists → Task 1 Step 1. ✓

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N" left — every step has concrete code or commands. ✓

**3. Type consistency:** Field names are consistent everywhere: `scriptsCreated`, `scriptsRefactored`, `scriptsFixed`, `execTotal`, `execPassed`, `execFailed`. Status values `ACTIVE|MAINTENANCE|PAUSED|DONE` match across enum (Task 1), constants (Task 4), validators (Task 6), and route (Task 7). `AutomationDailyLike`/`aggregateAutomationDailyToWeekly`/`passRate` signatures match between service (Task 3) and its test. ✓

**Gap intentionally deferred (not a miss):** FlowPilot automation task categories and PPTX/dashboard rendering are explicitly out of scope for this foundation plan and belong to Plans 2 and 3.
