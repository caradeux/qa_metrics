# Daily Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement email alerts that notify testers every workday morning if they didn't register DailyRecord for their active assignments the previous workday, with CC to ADMINs and project PMs.

**Architecture:** Modular API-side feature. A mailer adapter wraps Resend. A pure-logic module (`daily-alerts.ts`) handles workday math, query, and orchestration. An internal Express route (`/api/internal/run-daily-alerts`) exposes the action, authenticated by a shared secret header. Coolify Scheduled Task fires it at 09:00 CL Mon–Fri. No schema changes.

**Tech Stack:** TypeScript, Express 5, Prisma 7, Vitest, Resend SDK, date-fns, zod.

---

## File Structure

**New:**
- `apps/api/src/lib/mailer.ts` — Resend adapter exposing `sendMail({to, cc, subject, html, replyTo})`.
- `apps/api/src/lib/daily-alerts.ts` — Pure orchestration: `previousWorkday`, `findTestersWithMissingRecords`, `resolveCcRecipients`, `runDailyAlerts`.
- `apps/api/src/templates/daily-alert.ts` — `renderDailyAlert(ctx)` returning `{subject, html}`.
- `apps/api/src/routes/internal.routes.ts` — Router for `POST /api/internal/run-daily-alerts`.
- `apps/api/src/__tests__/daily-alerts.test.ts` — Unit tests for pure helpers.
- `apps/api/src/__tests__/internal-alerts.test.ts` — Integration test for endpoint.

**Modify:**
- `apps/api/package.json` — add `resend` dep.
- `apps/api/src/config/env.ts` — add env vars (`RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_REPLY_TO`, `INTERNAL_SECRET`, `APP_URL`).
- `apps/api/src/index.ts` — mount `internalRoutes` at `/api/internal`.

---

## Task 1: Install Resend + env vars

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config/env.ts`

- [ ] **Step 1: Install the resend package**

From repo root:
```bash
cd apps/api && npm install resend
```

Verify `package.json` shows `"resend": "^4.x"` (or current latest) in dependencies. Do not hand-edit the version.

- [ ] **Step 2: Add env vars to the zod schema**

Edit `apps/api/src/config/env.ts` — extend the schema:

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z.coerce.boolean().default(process.env.NODE_ENV === "production"),
  COOKIE_DOMAIN: z.string().optional(),

  // Alerts (optional — endpoint responds 503 if missing)
  RESEND_API_KEY: z.string().optional(),
  ALERT_FROM_EMAIL: z.string().email().optional(),
  ALERT_REPLY_TO: z.string().email().optional(),
  INTERNAL_SECRET: z.string().min(16).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
```

The alert envs are optional so existing envs continue validating. The internal route will return 503 when any required alert env is missing (covered in Task 5).

- [ ] **Step 3: Add stub values to local `.env`**

Append to `apps/api/.env` (do not commit):
```
RESEND_API_KEY=re_stub_dev
ALERT_FROM_EMAIL=notificaciones@qametrics.cl
ALERT_REPLY_TO=admin@qametrics.com
INTERNAL_SECRET=dev-internal-secret-at-least-16-chars
APP_URL=http://localhost:3000
```

Note: `.env` is gitignored. Real Resend key comes later during deploy.

- [ ] **Step 4: Typecheck passes**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/config/env.ts
git commit -m "chore(api): add resend dep and alert env vars"
```

---

## Task 2: Mailer adapter (TDD)

**Files:**
- Create: `apps/api/src/lib/mailer.ts`
- Create: `apps/api/src/__tests__/mailer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/mailer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the resend module before importing the mailer
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("mailer", () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    process.env.ALERT_FROM_EMAIL = "test@qametrics.cl";
  });

  it("forwards to/cc/subject/html/replyTo to resend", async () => {
    mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });
    const { sendMail } = await import("../lib/mailer.js");

    await sendMail({
      to: "juan@example.com",
      cc: ["admin@example.com"],
      subject: "Hola",
      html: "<p>test</p>",
      replyTo: "reply@example.com",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "test@qametrics.cl",
      to: ["juan@example.com"],
      cc: ["admin@example.com"],
      subject: "Hola",
      html: "<p>test</p>",
      replyTo: "reply@example.com",
    });
  });

  it("throws on resend error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "bad key" } });
    const { sendMail } = await import("../lib/mailer.js");
    await expect(
      sendMail({ to: "a@b.com", subject: "x", html: "y" }),
    ).rejects.toThrow("bad key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/__tests__/mailer.test.ts
```
Expected: FAIL — "Cannot find module '../lib/mailer.js'".

- [ ] **Step 3: Implement the mailer**

Create `apps/api/src/lib/mailer.ts`:

```typescript
import { Resend } from "resend";

export interface MailPayload {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const from = process.env.ALERT_FROM_EMAIL;
  if (!from) throw new Error("ALERT_FROM_EMAIL is not set");

  const { data, error } = await getClient().emails.send({
    from,
    to: [payload.to],
    cc: payload.cc && payload.cc.length ? payload.cc : undefined,
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo,
  });

  if (error) throw new Error(error.message ?? "Resend error");
  if (!data?.id) throw new Error("Resend returned no message id");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/__tests__/mailer.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/mailer.ts apps/api/src/__tests__/mailer.test.ts
git commit -m "feat(api): add Resend mailer adapter"
```

---

## Task 3: `previousWorkday` helper (TDD)

**Files:**
- Create (partial): `apps/api/src/lib/daily-alerts.ts`
- Create: `apps/api/src/__tests__/daily-alerts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/daily-alerts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { previousWorkday } from "../lib/daily-alerts.js";

describe("previousWorkday", () => {
  it("returns Friday when called on Monday with no holidays", () => {
    // Mon 2026-04-13
    const result = previousWorkday(new Date("2026-04-13T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-10"); // Fri
  });

  it("returns previous day when Tue->Mon", () => {
    const result = previousWorkday(new Date("2026-04-14T09:00:00-03:00"), []);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-13");
  });

  it("skips Chilean holidays", () => {
    const holidays = [new Date("2026-05-01")]; // Día del Trabajo
    // Mon 2026-05-04 -> Fri May 1 is holiday -> Thu Apr 30
    const result = previousWorkday(new Date("2026-05-04T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("skips weekends and consecutive holidays", () => {
    // Mon 2026-09-21 after two holidays Fri Sep 18 + Sat Sep 19 + Sun + ...
    const holidays = [new Date("2026-09-18"), new Date("2026-09-19")];
    const result = previousWorkday(new Date("2026-09-21T09:00:00-03:00"), holidays);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-17"); // Thu
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `previousWorkday`**

Create `apps/api/src/lib/daily-alerts.ts`:

```typescript
export function previousWorkday(from: Date, holidays: Date[]): Date {
  const holidayKeys = new Set(holidays.map((d) => d.toISOString().slice(0, 10)));
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - 1);
  while (true) {
    const day = d.getUTCDay();
    const key = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidayKeys.has(key)) return d;
    d.setUTCDate(d.getUTCDate() - 1);
  }
}

export function isWorkday(date: Date, holidays: Date[]): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const key = date.toISOString().slice(0, 10);
  return !holidays.some((h) => h.toISOString().slice(0, 10) === key);
}
```

Note: uses UTC day-of-week. Since Chile is fixed offset (no DST as of 2022+) and our Holiday rows are stored as calendar dates, UTC comparison is safe for day-level granularity.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/daily-alerts.ts apps/api/src/__tests__/daily-alerts.test.ts
git commit -m "feat(api): add previousWorkday helper for alert scheduler"
```

---

## Task 4: `findTestersWithMissingRecords` query (TDD with DB)

**Files:**
- Modify: `apps/api/src/lib/daily-alerts.ts`
- Modify: `apps/api/src/__tests__/daily-alerts.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `apps/api/src/__tests__/daily-alerts.test.ts`:

```typescript
import { prisma } from "@qa-metrics/database";
import { findTestersWithMissingRecords } from "../lib/daily-alerts.js";

describe("findTestersWithMissingRecords", () => {
  const day = new Date("2026-04-13"); // reference date

  it("returns testers with active assignments lacking DailyRecord for day", async () => {
    const results = await findTestersWithMissingRecords(day);

    // Asserts on the shape — real data depends on seed + prior tests.
    expect(Array.isArray(results)).toBe(true);
    for (const r of results) {
      expect(r).toHaveProperty("testerId");
      expect(r).toHaveProperty("testerName");
      expect(r).toHaveProperty("email");
      expect(Array.isArray(r.missingAssignments)).toBe(true);
      for (const a of r.missingAssignments) {
        expect(a).toHaveProperty("assignmentId");
        expect(a).toHaveProperty("storyTitle");
        expect(a).toHaveProperty("projectId");
        expect(a).toHaveProperty("projectName");
        // Must not contain excluded statuses
        expect(["ON_HOLD", "PRODUCTION", "UAT", "WAITING_UAT"]).not.toContain(a.status);
      }
    }
  });

  it("returns empty array when day is far in the future (no active assignments)", async () => {
    const far = new Date("2099-01-01");
    const results = await findTestersWithMissingRecords(far);
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to see first assertion fails on missing export**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: FAIL — `findTestersWithMissingRecords` not exported.

- [ ] **Step 3: Implement the query**

Append to `apps/api/src/lib/daily-alerts.ts`:

```typescript
import { prisma } from "@qa-metrics/database";

const EXCLUDED_STATUSES = ["ON_HOLD", "PRODUCTION", "UAT", "WAITING_UAT"] as const;

export interface MissingAssignment {
  assignmentId: string;
  storyId: string;
  storyExternalId: string | null;
  storyTitle: string;
  projectId: string;
  projectName: string;
  status: string;
}

export interface TesterWithMissing {
  testerId: string;
  testerName: string;
  email: string;
  missingAssignments: MissingAssignment[];
}

export async function findTestersWithMissingRecords(
  day: Date,
): Promise<TesterWithMissing[]> {
  const dayStart = new Date(day);
  dayStart.setUTCHours(0, 0, 0, 0);

  // Testers with user linked + email; load active assignments and any DailyRecord for the day.
  const testers = await prisma.tester.findMany({
    where: {
      user: { email: { not: undefined }, active: true },
    },
    select: {
      id: true,
      name: true,
      user: { select: { email: true } },
      assignments: {
        where: {
          status: { notIn: EXCLUDED_STATUSES as unknown as string[] },
          startDate: { lte: dayStart },
          OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
        },
        select: {
          id: true,
          status: true,
          storyId: true,
          story: {
            select: {
              id: true,
              externalId: true,
              title: true,
              projectId: true,
              project: { select: { id: true, name: true } },
            },
          },
          dailyRecords: {
            where: { date: dayStart },
            select: { id: true },
          },
        },
      },
    },
  });

  const out: TesterWithMissing[] = [];
  for (const t of testers) {
    if (!t.user?.email) continue;
    const missing = t.assignments.filter((a) => a.dailyRecords.length === 0);
    if (missing.length === 0) continue;
    out.push({
      testerId: t.id,
      testerName: t.name,
      email: t.user.email,
      missingAssignments: missing.map((a) => ({
        assignmentId: a.id,
        storyId: a.story.id,
        storyExternalId: a.story.externalId,
        storyTitle: a.story.title,
        projectId: a.story.project.id,
        projectName: a.story.project.name,
        status: a.status,
      })),
    });
  }
  return out;
}
```

Note: the Prisma include path `story.project` follows the existing schema. If `story.projectId` relation differs, adjust based on `schema.prisma`.

- [ ] **Step 4: Run test to verify passes**

Ensure API isn't running against same DB to avoid test collisions. Then:
```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: all prior tests + 2 new passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/daily-alerts.ts apps/api/src/__tests__/daily-alerts.test.ts
git commit -m "feat(api): query testers with missing DailyRecords"
```

---

## Task 5: `resolveCcRecipients` helper (TDD)

**Files:**
- Modify: `apps/api/src/lib/daily-alerts.ts`
- Modify: `apps/api/src/__tests__/daily-alerts.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/__tests__/daily-alerts.test.ts`:

```typescript
import { resolveCcRecipients } from "../lib/daily-alerts.js";

describe("resolveCcRecipients", () => {
  it("returns distinct emails from admins + PMs of given projects", async () => {
    // Integration against real seed: expect admin@qametrics.com present
    const cc = await resolveCcRecipients([]); // no projects — only admins
    expect(cc).toContain("admin@qametrics.com");
    // No duplicates
    expect(new Set(cc).size).toBe(cc.length);
  });

  it("dedupes when an admin is also PM of one of the projects", async () => {
    // Rely on seed: find any project with PM, pass that projectId
    const anyPm = await prisma.project.findFirst({
      where: { projectManagerId: { not: null } },
      select: { id: true, projectManager: { select: { email: true } } },
    });
    if (!anyPm?.projectManager) return; // skip if no PM in seed
    const cc = await resolveCcRecipients([anyPm.id]);
    const count = cc.filter((e) => e === anyPm.projectManager!.email).length;
    expect(count).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: FAIL — export not found.

- [ ] **Step 3: Implement**

Append to `apps/api/src/lib/daily-alerts.ts`:

```typescript
export async function resolveCcRecipients(projectIds: string[]): Promise<string[]> {
  const [admins, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: { name: "ADMIN" }, active: true, email: { not: undefined } },
      select: { email: true },
    }),
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds }, projectManagerId: { not: null } },
          select: { projectManager: { select: { email: true, active: true } } },
        })
      : Promise.resolve([]),
  ]);

  const emails = new Set<string>();
  for (const a of admins) if (a.email) emails.add(a.email);
  for (const p of projects) {
    if (p.projectManager?.active && p.projectManager.email) {
      emails.add(p.projectManager.email);
    }
  }
  return [...emails];
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/daily-alerts.ts apps/api/src/__tests__/daily-alerts.test.ts
git commit -m "feat(api): resolve CC (admins + PMs) for daily alerts"
```

---

## Task 6: Email template (TDD)

**Files:**
- Create: `apps/api/src/templates/daily-alert.ts`
- Create: `apps/api/src/__tests__/daily-alert-template.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/daily-alert-template.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderDailyAlert } from "../templates/daily-alert.js";

describe("renderDailyAlert", () => {
  const ctx = {
    testerName: "Juan Pérez",
    dayLabel: "lunes 13 de abril de 2026",
    missingAssignments: [
      {
        storyExternalId: "HU-342",
        storyTitle: "Validación de formulario",
        projectName: "Proyecto Alfa",
        status: "EXECUTION",
      },
      {
        storyExternalId: null,
        storyTitle: "Login SSO",
        projectName: "Proyecto Beta",
        status: "TEST_DESIGN",
      },
    ],
    appUrl: "https://qametrics.cl",
  };

  it("includes tester name, day label and subject with warning", () => {
    const { subject, html } = renderDailyAlert(ctx);
    expect(subject).toContain("No registraste movimientos");
    expect(subject).toContain("lunes 13 de abril de 2026");
    expect(html).toContain("Juan Pérez");
    expect(html).toContain("lunes 13 de abril de 2026");
  });

  it("lists each missing assignment with project and story label", () => {
    const { html } = renderDailyAlert(ctx);
    expect(html).toContain("HU-342 — Validación de formulario");
    expect(html).toContain("Login SSO");
    expect(html).toContain("Proyecto Alfa");
    expect(html).toContain("Proyecto Beta");
  });

  it("includes CTA link to mi-semana", () => {
    const { html } = renderDailyAlert(ctx);
    expect(html).toContain("https://qametrics.cl/mi-semana");
  });

  it("escapes HTML in tester and title", () => {
    const { html } = renderDailyAlert({
      ...ctx,
      testerName: "<script>x</script>",
      missingAssignments: [
        { storyExternalId: null, storyTitle: "<b>pwn</b>", projectName: "p", status: "EXECUTION" },
      ],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>pwn</b>");
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alert-template.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the template**

Create `apps/api/src/templates/daily-alert.ts`:

```typescript
export interface DailyAlertContext {
  testerName: string;
  dayLabel: string;
  missingAssignments: Array<{
    storyExternalId: string | null;
    storyTitle: string;
    projectName: string;
    status: string;
  }>;
  appUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "No Iniciado",
  ANALYSIS: "Análisis",
  TEST_DESIGN: "Diseño",
  WAITING_QA_DEPLOY: "Esperando Deploy QA",
  EXECUTION: "Ejecución",
  RETURNED_TO_DEV: "Devuelto a Desarrollo",
};

export function renderDailyAlert(ctx: DailyAlertContext): { subject: string; html: string } {
  const subject = `⚠️ QA Metrics · No registraste movimientos el ${ctx.dayLabel}`;

  const rows = ctx.missingAssignments
    .map((a) => {
      const label = a.storyExternalId
        ? `${escapeHtml(a.storyExternalId)} — ${escapeHtml(a.storyTitle)}`
        : escapeHtml(a.storyTitle);
      const statusLabel = STATUS_LABELS[a.status] ?? escapeHtml(a.status);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(a.projectName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${statusLabel}</td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1F3864;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7;">QA Metrics</p>
      <h1 style="margin:4px 0 0;font-size:20px;">Recordatorio de registro diario</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <p>Hola <strong>${escapeHtml(ctx.testerName)}</strong>,</p>
      <p>El siguiente avance no fue registrado el <strong>${escapeHtml(ctx.dayLabel)}</strong>. Registra lo que trabajaste (o indica cero si no avanzaste) para mantener las métricas al día.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;text-align:left;">
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Historia</th>
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Proyecto</th>
            <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(ctx.appUrl)}/mi-semana"
           style="display:inline-block;background:#1F3864;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">
          Ir a Mi Semana
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        Si no trabajaste ayer (licencia, feriado, vacaciones), avisa al admin o al PM del proyecto.<br/>
        Si ya registraste y este correo es un error, contáctanos.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alert-template.test.ts
```
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/templates/daily-alert.ts apps/api/src/__tests__/daily-alert-template.test.ts
git commit -m "feat(api): add HTML template for daily alert email"
```

---

## Task 7: `runDailyAlerts` orchestrator (TDD with mocked mailer)

**Files:**
- Modify: `apps/api/src/lib/daily-alerts.ts`
- Modify: `apps/api/src/__tests__/daily-alerts.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/__tests__/daily-alerts.test.ts`:

```typescript
import { runDailyAlerts } from "../lib/daily-alerts.js";
import { vi } from "vitest";

vi.mock("../lib/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

describe("runDailyAlerts", () => {
  it("returns summary in dryRun mode without calling mailer", async () => {
    const { sendMail } = await import("../lib/mailer.js");
    (sendMail as any).mockClear();

    // Use a fixed "today" in the past to hit seeded data deterministically.
    const result = await runDailyAlerts({
      today: new Date("2026-04-14T09:00:00Z"),
      dryRun: true,
    });

    expect(result).toHaveProperty("dayChecked");
    expect(result).toHaveProperty("testersNotified");
    expect(result).toHaveProperty("assignmentsFlagged");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("skips when today is a weekend", async () => {
    const result = await runDailyAlerts({
      today: new Date("2026-04-12T09:00:00Z"), // Sunday
    });
    expect((result as any).skipped).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: FAIL — `runDailyAlerts` not exported.

- [ ] **Step 3: Implement orchestrator**

Append to `apps/api/src/lib/daily-alerts.ts`:

```typescript
import { sendMail } from "./mailer.js";
import { renderDailyAlert } from "../templates/daily-alert.js";

export interface RunResult {
  dayChecked: string;
  testersNotified: number;
  assignmentsFlagged: number;
  errors: Array<{ testerId?: string; email?: string; message: string }>;
  skipped?: boolean;
  reason?: string;
  payloads?: Array<{ to: string; cc: string[]; subject: string; html: string }>;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export async function runDailyAlerts(opts: {
  today?: Date;
  dryRun?: boolean;
}): Promise<RunResult> {
  const today = opts.today ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const replyTo = process.env.ALERT_REPLY_TO;

  const holidayRows = await prisma.holiday.findMany({ select: { date: true } });
  const holidays = holidayRows.map((h) => h.date);

  if (!isWorkday(today, holidays)) {
    return {
      dayChecked: "",
      testersNotified: 0,
      assignmentsFlagged: 0,
      errors: [],
      skipped: true,
      reason: "non-workday",
    };
  }

  const dayToCheck = previousWorkday(today, holidays);
  const testers = await findTestersWithMissingRecords(dayToCheck);

  const result: RunResult = {
    dayChecked: dayToCheck.toISOString().slice(0, 10),
    testersNotified: 0,
    assignmentsFlagged: 0,
    errors: [],
    payloads: dryRun ? [] : undefined,
  };

  const label = dayLabel(dayToCheck);

  for (const t of testers) {
    try {
      const projectIds = [...new Set(t.missingAssignments.map((a) => a.projectId))];
      const cc = await resolveCcRecipients(projectIds);
      const { subject, html } = renderDailyAlert({
        testerName: t.testerName,
        dayLabel: label,
        missingAssignments: t.missingAssignments,
        appUrl,
      });

      if (dryRun) {
        result.payloads!.push({ to: t.email, cc, subject, html });
      } else {
        await sendMail({ to: t.email, cc, subject, html, replyTo });
      }

      result.testersNotified += 1;
      result.assignmentsFlagged += t.missingAssignments.length;
    } catch (err: any) {
      result.errors.push({
        testerId: t.testerId,
        email: t.email,
        message: err?.message ?? String(err),
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx vitest run src/__tests__/daily-alerts.test.ts
```
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/daily-alerts.ts apps/api/src/__tests__/daily-alerts.test.ts
git commit -m "feat(api): orchestrator runDailyAlerts with dryRun support"
```

---

## Task 8: Internal route + auth (TDD)

**Files:**
- Create: `apps/api/src/routes/internal.routes.ts`
- Create: `apps/api/src/__tests__/internal-alerts.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/__tests__/internal-alerts.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { API_URL } from "./helpers/auth.js";

describe("POST /api/internal/run-daily-alerts", () => {
  beforeAll(() => {
    process.env.INTERNAL_SECRET = "dev-internal-secret-at-least-16-chars";
  });

  it("returns 403 without secret header", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts`, { method: "POST" });
    expect(r.status).toBe(403);
  });

  it("returns 403 with wrong secret", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts`, {
      method: "POST",
      headers: { "X-Internal-Secret": "wrong" },
    });
    expect(r.status).toBe(403);
  });

  it("returns 200 with correct secret and dryRun=true", async () => {
    const r = await fetch(`${API_URL}/api/internal/run-daily-alerts?dryRun=true`, {
      method: "POST",
      headers: { "X-Internal-Secret": process.env.INTERNAL_SECRET! },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("dayChecked");
    expect(body).toHaveProperty("testersNotified");
    expect(body).toHaveProperty("assignmentsFlagged");
    expect(body).toHaveProperty("errors");
  });
});
```

- [ ] **Step 2: Run to confirm failure (API not yet exposing route)**

Start dev server in another terminal (`npm run dev`), then:
```bash
cd apps/api && npx vitest run src/__tests__/internal-alerts.test.ts
```
Expected: 404 or route-not-found failures.

- [ ] **Step 3: Create the route**

Create `apps/api/src/routes/internal.routes.ts`:

```typescript
import { Router, type Request, type Response } from "express";
import { runDailyAlerts } from "../lib/daily-alerts.js";

const router = Router();

function requireInternalSecret(req: Request, res: Response): boolean {
  const expected = process.env.INTERNAL_SECRET;
  if (!expected) {
    res.status(503).json({ error: "INTERNAL_SECRET not configured" });
    return false;
  }
  const provided = req.header("X-Internal-Secret");
  if (provided !== expected) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.post("/run-daily-alerts", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;
  const dryRun = req.query.dryRun === "true";
  try {
    const result = await runDailyAlerts({ dryRun });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
```

- [ ] **Step 4: Mount in `index.ts`**

Edit `apps/api/src/index.ts` — add the import and mount (near the other route imports and `app.use` calls):

```typescript
import internalRoutes from "./routes/internal.routes.js";
// ...
app.use("/api/internal", internalRoutes);
```

Place the `app.use("/api/internal", internalRoutes)` near the other route mounts (after `auditRoutes`).

- [ ] **Step 5: Restart the dev server and re-run the test**

```bash
cd apps/api && npx vitest run src/__tests__/internal-alerts.test.ts
```
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/internal.routes.ts apps/api/src/index.ts apps/api/src/__tests__/internal-alerts.test.ts
git commit -m "feat(api): internal endpoint /api/internal/run-daily-alerts"
```

---

## Task 9: Full typecheck + existing tests regression

**Files:** (no new files)

- [ ] **Step 1: Typecheck everything in API**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors (pre-existing TS2322 on `req.params.id` are allowed if they existed before).

- [ ] **Step 2: Run full API test suite**

Ensure dev server is running (for integration tests that hit HTTP):
```bash
cd apps/api && npm test
```
Expected: all tests green, including the existing suite (activities, etc.).

- [ ] **Step 3: Smoke test `dryRun` manually**

```bash
curl -s -X POST "http://localhost:4000/api/internal/run-daily-alerts?dryRun=true" \
     -H "X-Internal-Secret: dev-internal-secret-at-least-16-chars" | jq .
```
Expected: JSON with `dayChecked`, `testersNotified`, arrays. With stub Resend key, no real emails are sent even if `dryRun=false`, but `dryRun=true` is the safe path.

- [ ] **Step 4: Commit if any small fixups were needed**

If the steps above revealed trivial fixes (imports, formatting), commit them:
```bash
git add -A
git commit -m "chore(api): fixups after full regression"
```

Otherwise skip this step.

---

## Task 10: Documentation for deploy + Coolify setup

**Files:**
- Create: `apps/api/docs/daily-alerts-runbook.md`

- [ ] **Step 1: Write the runbook**

Create `apps/api/docs/daily-alerts-runbook.md`:

```markdown
# Daily Alerts — Runbook

## Setup inicial (una sola vez)

### 1. Verificar dominio en Resend

1. Crear cuenta en https://resend.com (plan free).
2. Ir a **Domains** → **Add Domain** → `qametrics.cl`.
3. Copiar los 3 DNS records (SPF, DKIM, MX) que muestra Resend.
4. Agregarlos en el panel DNS de `qametrics.cl`.
5. Volver a Resend y esperar que el dominio quede **Verified**.
6. Crear API key en **API Keys** con permiso "Full access" (o "Send emails").

### 2. Env vars en Coolify

En la app del API, agregar como secrets:

| Var | Valor |
|---|---|
| `RESEND_API_KEY` | `re_xxx` (la API key recién generada) |
| `ALERT_FROM_EMAIL` | `notificaciones@qametrics.cl` |
| `ALERT_REPLY_TO` | `admin@qametrics.com` (o la casilla del líder QA) |
| `INTERNAL_SECRET` | Random 32+ chars (`openssl rand -hex 32`) |
| `APP_URL` | `https://qametrics.cl` |

Redeploy la API para que tome las vars.

### 3. Scheduled Task en Coolify

- **Comando**:
  ```
  curl -X POST https://qametrics.cl/api/internal/run-daily-alerts \
       -H "X-Internal-Secret: $INTERNAL_SECRET"
  ```
- **Schedule (cron)**: `0 9 * * 1-5`
- **Timezone**: `America/Santiago`

### 4. Smoke test antes del primer cron real

Manual (con dryRun):
```
curl -s -X POST "https://qametrics.cl/api/internal/run-daily-alerts?dryRun=true" \
     -H "X-Internal-Secret: <secret>" | jq .
```

Debe devolver el JSON con `testersNotified` ≥ 0 y ningún correo real enviado.

## Rollback

Deshabilitar la Scheduled Task en Coolify. El código queda deployado pero ya no se ejecuta.

## Troubleshooting

- **Resend 422 "domain not verified"**: faltan DNS records. Revisar panel Resend.
- **Correos van a spam**: verificar SPF + DKIM en herramientas tipo mail-tester.com.
- **403 del endpoint**: secret mismatch entre la Scheduled Task y la env var del API.
- **`skipped: true` en un día hábil**: la fecha de hoy cayó en `Holiday` de la DB. Revisar `prisma.holiday`.
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/docs/daily-alerts-runbook.md
git commit -m "docs(api): runbook for daily alerts deployment"
```

---

## Self-Review Notes

- **Spec coverage**: Todas las decisiones del spec tienen task: trigger (Task 7 orchestrator), Resend + qametrics.cl (Task 2 + runbook), CC admins + PMs (Task 5), previousWorkday con feriados (Task 3), filtros de status (Task 4), auth por header (Task 8), dryRun (Task 7+8), runbook Coolify (Task 10).
- **Placeholder scan**: sin "TBD"/"TODO"/"add error handling". Cada paso tiene código concreto.
- **Type consistency**: `MissingAssignment` usado en `findTestersWithMissingRecords` y `renderDailyAlert` tiene shape consistente. `RunResult.payloads` opcional, definido donde se usa.
- **Fuera de scope v1** (queda explícito en el spec): opt-out por tester, digest admin separado, idempotencia DB.
