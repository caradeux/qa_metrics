# Reporte PPTX Profesional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la generación de PPTX (weekly/monthly/yearly) por un módulo profesional construido con `pptxgenjs`, usando la paleta oficial de Inovabiz, con curva "siempre ocupados" por proyecto, matriz de complejidad por HU con número de regresión, y anexo interno por analista.

**Architecture:** Un módulo autocontenido `apps/api/src/lib/pptx/` con tres capas: (1) `types.ts` + `theme.ts` como contratos, (2) `report-data.ts` que agrega datos de Prisma a un `ReportSpec`, (3) un set de generadores de charts (PNG vía `chartjs-node-canvas`) y slide builders (pptxgenjs). El orquestador `build-report-pptx.ts` ensambla el deck. Los tres endpoints existentes mantienen su URL y reutilizan el mismo pipeline cambiando solo el rango.

**Tech Stack:** `pptxgenjs ^4.0.1` (ya instalado), `chartjs-node-canvas ^5.0.0` (ya instalado), Prisma 7, Vitest, TypeScript strict.

**Spec de referencia:** `docs/superpowers/specs/2026-04-22-reporte-pptx-profesional-design.md`

---

## File Structure

Archivos nuevos:

```
apps/api/src/
├── assets/inovabiz-logo.svg                  (copia del SVG oficial)
├── lib/pptx/
│   ├── theme.ts                              (paleta, fuentes, dimensiones)
│   ├── types.ts                              (ReportSpec, ProjectReportData…)
│   ├── report-data.ts                        (Prisma → ReportSpec, scope-aware)
│   ├── occupation-math.ts                    (lógica pura de bandas "siempre ocupados")
│   ├── charts/
│   │   ├── occupation-chart.ts               (PNG stacked area)
│   │   ├── complexity-matrix.ts              (PNG bubble 3×3)
│   │   └── portfolio-charts.ts               (PNG pipeline donut + bars + trend)
│   ├── slides/
│   │   ├── cover.ts
│   │   ├── executive-summary.ts
│   │   ├── project-cover.ts
│   │   ├── project-hu-table.ts
│   │   ├── project-occupation-curve.ts
│   │   ├── project-complexity-matrix.ts
│   │   ├── portfolio-pipeline.ts
│   │   ├── portfolio-comparison.ts
│   │   ├── portfolio-trend.ts
│   │   ├── appendix-divider.ts
│   │   ├── analyst-detail.ts
│   │   └── closing.ts
│   └── build-report-pptx.ts                  (orquestador)
└── __tests__/
    ├── pptx-occupation-math.test.ts          (TDD fórmulas Paso 1-6)
    ├── pptx-report-data.test.ts              (TDD agregación + scope)
    ├── pptx-build-smoke.test.ts              (smoke test 3 endpoints)
```

Archivos eliminados:

```
apps/api/src/lib/weekly-pptx.ts
apps/api/src/lib/weekly-charts.ts
apps/api/src/assets/weekly-template.pptx
```

Archivos modificados:

```
apps/api/src/routes/reports.routes.ts        (3 endpoints rehechos)
```

---

## Task 1: Copiar logo Inovabiz como asset del API

**Files:**
- Create: `apps/api/src/assets/inovabiz-logo.svg`

- [ ] **Step 1: Crear carpeta assets si no existe y copiar el SVG**

```bash
mkdir -p apps/api/src/assets
cp docs/logo-inovabiz.svg apps/api/src/assets/inovabiz-logo.svg
```

- [ ] **Step 2: Verificar que el archivo copiado conserva los 9532 bytes del original**

Run: `ls -la apps/api/src/assets/inovabiz-logo.svg`
Expected: tamaño 9532 bytes (idéntico a `docs/logo-inovabiz.svg`)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/assets/inovabiz-logo.svg
git commit -m "chore(api): add Inovabiz logo asset for PPTX reports"
```

---

## Task 2: Crear `theme.ts` con paleta Inovabiz y constantes de layout

**Files:**
- Create: `apps/api/src/lib/pptx/theme.ts`

- [ ] **Step 1: Crear el archivo con la paleta y dimensiones**

```ts
// apps/api/src/lib/pptx/theme.ts
// Paleta oficial Inovabiz (extraída del logo SVG y CSS de inovabiz.com).

export const PALETTE = {
  greenPrimary: "25CF6C",
  greenLight: "94CE94",
  cyan: "04E5F3",
  blue: "08ACF4",
  navyDeep: "0F172A",
  navyUi: "1F2937",
  white: "FFFFFF",
  grayLight: "F9FAFB",
  textPrimary: "111827",
  textMuted: "6B7280",
  amber: "F59E0B",
  red: "EF4444",
  purple: "A855F7",
  // Fases (usadas en bandas de la curva "siempre ocupados")
  phaseAnalysis: "94C7E3",
  phaseDesign: "08ACF4",
  phaseExecution: "25CF6C",
  // Fases Activity (no-productivas)
  activityUserMeeting: "04E5F3",
  activityDevMeeting: "A855F7",
  activityInduction: "F59E0B",
  activityUnassigned: "6B7280",
} as const;

export const FONT = {
  face: "Inter",
  fallback: "Segoe UI, Arial, sans-serif",
} as const;

// Dimensiones del slide (16:9). pptxgenjs usa pulgadas.
export const SLIDE = {
  widthIn: 13.333,
  heightIn: 7.5,
  marginIn: 0.5,
} as const;

// Z-index / tamaños comunes
export const SIZE = {
  titleBig: 44,
  titleMed: 28,
  titleSmall: 20,
  body: 14,
  kpiBig: 48,
  kpiLabel: 12,
  tableHeader: 11,
  tableRow: 10,
  muted: 10,
} as const;

export const GRADIENTS = {
  greenHero: { from: "25CF6C", to: "94CE94", angle: 135 },
  cyanBlue: { from: "04E5F3", to: "08ACF4", angle: 135 },
} as const;
```

- [ ] **Step 2: Verificar que compila (typecheck)**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/theme.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/theme.ts
git commit -m "feat(api): add Inovabiz PPTX theme palette and layout constants"
```

---

## Task 3: Crear `types.ts` con el contrato `ReportSpec`

**Files:**
- Create: `apps/api/src/lib/pptx/types.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// apps/api/src/lib/pptx/types.ts
import type { OccupationResult } from "../occupation.js";

export type ReportPeriod = "weekly" | "monthly" | "yearly";

export type ComplexityLevel = "LOW" | "MEDIUM" | "HIGH";

export interface HuRow {
  storyId: string;
  externalId: string | null;
  title: string;
  regressionNumber: number;       // story.cycles.length
  designComplexity: ComplexityLevel;
  executionComplexity: ComplexityLevel;
  status: string;                  // AssignmentStatus interno
  statusLabel: string;             // "En Diseño", "En Curso", etc.
  designed: number;
  executed: number;
  defects: number;
}

export interface ComplexityBubble {
  storyId: string;
  title: string;
  designComplexity: ComplexityLevel;
  executionComplexity: ComplexityLevel;
  size: number;                    // designed + executed del periodo
  statusLabel: string;
}

export interface OccupationBand {
  label:
    | "Análisis"
    | "Diseño de pruebas"
    | "Ejecución"
    | "Reunión con usuario"
    | "Reunión con desarrollo"
    | "Inducción/Capacitación"
    | "Productivas no imputadas";
  colorHex: string;
  values: number[];                // uno por bucket
}

export interface OccupationBucket {
  label: string;                   // "Lun", "Sem 15", "Abr", etc.
  capacityHours: number;           // guía superior
}

export interface ProjectOccupationCurve {
  buckets: OccupationBucket[];
  bands: OccupationBand[];
}

export interface ProjectPipeline {
  label: string;                   // "En Diseño", etc.
  count: number;
  colorHex: string;
}

export interface ProjectReportData {
  projectId: string;
  projectName: string;
  clientName: string;
  projectManagerName: string | null;
  testers: Array<{ id: string; name: string; allocation: number }>;
  kpis: {
    designed: number;
    executed: number;
    defects: number;
  };
  pipeline: ProjectPipeline[];
  hus: HuRow[];
  complexityBubbles: ComplexityBubble[];
  occupationCurve: ProjectOccupationCurve;
}

export interface PortfolioKpis {
  designed: number;
  executed: number;
  defects: number;
  ratioPct: number;
  husFirstCycle: number;
  husMultipleCycles: number;
  capacityUtilizationPct: number;
  totalProjects: number;
  totalAnalysts: number;
}

export interface PortfolioTrendPoint {
  label: string;                   // "Lun 15", "Sem 15", "Abr", etc.
  designed: number;
  executed: number;
  defects: number;
}

export interface ReportSpec {
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;             // "Semana del 15 al 19 abr 2026" | "Abril 2026" | "Año 2026"
  clientFilter: { id: string; name: string } | null;
  projects: ProjectReportData[];
  analysts: OccupationResult[];    // reutiliza tipo existente de occupation.ts
  portfolio: {
    kpis: PortfolioKpis;
    pipeline: ProjectPipeline[];
    comparison: Array<{ projectName: string; designed: number; executed: number }>;
    trend: PortfolioTrendPoint[];
  };
  includeInternalAppendix: boolean; // false para CLIENT_PM, true para el resto
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/types.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/types.ts
git commit -m "feat(api): add ReportSpec types for PPTX module"
```

---

## Task 4: TDD — fórmula de capacidad y horas productivas (`occupation-math.ts`)

**Files:**
- Create: `apps/api/src/__tests__/pptx-occupation-math.test.ts`
- Create: `apps/api/src/lib/pptx/occupation-math.ts`

- [ ] **Step 1: Escribir el primer test fallido (capacidad diaria)**

```ts
// apps/api/src/__tests__/pptx-occupation-math.test.ts
import { describe, it, expect } from "vitest";
import { dailyCapacityHours } from "../lib/pptx/occupation-math.js";

describe("dailyCapacityHours", () => {
  it("L-V con allocation=100 → 8h", () => {
    const monday = new Date(Date.UTC(2026, 3, 13)); // lunes 13-abr-2026
    expect(dailyCapacityHours(monday, 100, new Set())).toBe(8);
  });

  it("sábado → 0h aunque allocation=100", () => {
    const saturday = new Date(Date.UTC(2026, 3, 18));
    expect(dailyCapacityHours(saturday, 100, new Set())).toBe(0);
  });

  it("allocation=50 en día hábil → 4h", () => {
    const monday = new Date(Date.UTC(2026, 3, 13));
    expect(dailyCapacityHours(monday, 50, new Set())).toBe(4);
  });

  it("día hábil pero feriado → 0h", () => {
    const firstMay = new Date(Date.UTC(2026, 4, 1));
    const holidays = new Set([firstMay.getTime()]);
    expect(dailyCapacityHours(firstMay, 100, holidays)).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar fallo**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: FAIL — `Cannot find module '../lib/pptx/occupation-math.js'`

- [ ] **Step 3: Implementar `dailyCapacityHours`**

```ts
// apps/api/src/lib/pptx/occupation-math.ts

/**
 * Capacidad diaria de un tester en horas.
 * - 0 en fin de semana o feriado.
 * - 8h × (allocation/100) en día hábil.
 *
 * @param day  Fecha (se considera la parte de día UTC)
 * @param allocation  Porcentaje 0-100
 * @param holidaysMs  Set con timestamps ms (getTime()) de feriados en UTC medianoche
 */
export function dailyCapacityHours(
  day: Date,
  allocation: number,
  holidaysMs: Set<number>,
): number {
  const dow = day.getUTCDay();
  if (dow === 0 || dow === 6) return 0;
  const dayStartMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  if (holidaysMs.has(dayStartMs)) return 0;
  return 8 * (allocation / 100);
}
```

- [ ] **Step 4: Ejecutar test y confirmar PASS**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/pptx/occupation-math.ts apps/api/src/__tests__/pptx-occupation-math.test.ts
git commit -m "feat(api): add dailyCapacityHours primitive for PPTX occupation curve"
```

---

## Task 5: TDD — reparto de horas productivas entre fases (proyecto)

**Files:**
- Modify: `apps/api/src/__tests__/pptx-occupation-math.test.ts`
- Modify: `apps/api/src/lib/pptx/occupation-math.ts`

- [ ] **Step 1: Añadir tests para `splitProductiveHoursAcrossPhases`**

Apéndice al archivo de test (al final):

```ts
import { splitProductiveHoursAcrossPhases } from "../lib/pptx/occupation-math.js";
import type { AssignmentPhaseType } from "@qa-metrics/database";

describe("splitProductiveHoursAcrossPhases", () => {
  type Phase = { type: AssignmentPhaseType; projectId: string };

  it("single phase in project P → todas las horas a esa fase", () => {
    const phases: Phase[] = [{ type: "EXECUTION", projectId: "P" }];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(8);
    expect(out.byPhase).toEqual({ ANALYSIS: 0, TEST_DESIGN: 0, EXECUTION: 8 });
  });

  it("dos phases en P distintas → reparto proporcional", () => {
    const phases: Phase[] = [
      { type: "TEST_DESIGN", projectId: "P" },
      { type: "EXECUTION", projectId: "P" },
    ];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(8);
    expect(out.byPhase.TEST_DESIGN).toBe(4);
    expect(out.byPhase.EXECUTION).toBe(4);
  });

  it("tester con phases en P y en Q → P recibe su proporción", () => {
    const phases: Phase[] = [
      { type: "EXECUTION", projectId: "P" },
      { type: "ANALYSIS", projectId: "Q" },
    ];
    const out = splitProductiveHoursAcrossPhases(8, phases, "P");
    expect(out.projectHours).toBe(4);
    expect(out.byPhase.EXECUTION).toBe(4);
    expect(out.byPhase.ANALYSIS).toBe(0);
  });

  it("tester sin phases activas → 0 horas a P", () => {
    const out = splitProductiveHoursAcrossPhases(8, [], "P");
    expect(out.projectHours).toBe(0);
    expect(out.byPhase).toEqual({ ANALYSIS: 0, TEST_DESIGN: 0, EXECUTION: 0 });
  });

  it("productiveHours=0 → todo cero", () => {
    const phases: Phase[] = [{ type: "EXECUTION", projectId: "P" }];
    const out = splitProductiveHoursAcrossPhases(0, phases, "P");
    expect(out.projectHours).toBe(0);
    expect(out.byPhase.EXECUTION).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: FAIL — `splitProductiveHoursAcrossPhases is not a function`

- [ ] **Step 3: Implementar la función**

Añadir al final de `apps/api/src/lib/pptx/occupation-math.ts`:

```ts
import type { AssignmentPhaseType } from "@qa-metrics/database";

export interface PhaseRef {
  type: AssignmentPhaseType;
  projectId: string;
}

export interface SplitResult {
  projectHours: number;
  byPhase: Record<AssignmentPhaseType, number>;
}

/**
 * Reparte `productiveHours` de un tester entre las fases activas,
 * devolviendo solo la porción que corresponde al `targetProjectId`.
 *
 * Fórmula spec §5.1 Paso 4:
 *   share_P = #phasesActivas(t, d, P) / #phasesActivas(t, d, *)
 *   horasFase(t, d, fase, P) = productive × share_P × (#phases_P_tipo_fase / #phases_P)
 */
export function splitProductiveHoursAcrossPhases(
  productiveHours: number,
  phases: readonly PhaseRef[],
  targetProjectId: string,
): SplitResult {
  const empty: Record<AssignmentPhaseType, number> = {
    ANALYSIS: 0,
    TEST_DESIGN: 0,
    EXECUTION: 0,
  };
  if (productiveHours <= 0 || phases.length === 0) {
    return { projectHours: 0, byPhase: empty };
  }
  const inProject = phases.filter((p) => p.projectId === targetProjectId);
  if (inProject.length === 0) {
    return { projectHours: 0, byPhase: empty };
  }
  const projectHours = productiveHours * (inProject.length / phases.length);
  const byPhase: Record<AssignmentPhaseType, number> = { ...empty };
  for (const p of inProject) {
    byPhase[p.type] += projectHours / inProject.length;
  }
  return { projectHours, byPhase };
}
```

- [ ] **Step 4: Ejecutar tests, todos en verde**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: PASS 9/9

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/pptx/occupation-math.ts apps/api/src/__tests__/pptx-occupation-math.test.ts
git commit -m "feat(api): split productive hours across phases for project-scoped occupation curve"
```

---

## Task 6: TDD — reparto de Activity transversal entre proyectos

**Files:**
- Modify: `apps/api/src/__tests__/pptx-occupation-math.test.ts`
- Modify: `apps/api/src/lib/pptx/occupation-math.ts`

- [ ] **Step 1: Añadir tests para `splitTransversalActivityHours`**

Al final del archivo de test:

```ts
import { splitTransversalActivityHours } from "../lib/pptx/occupation-math.js";

describe("splitTransversalActivityHours", () => {
  it("activity con assignmentId resuelto a P → 100% a P, 0 a Q", () => {
    const out = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: "P",
      phasesByProject: { P: 1, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    expect(out).toBe(2);
  });

  it("misma activity vista desde Q → 0", () => {
    const out = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: "P",
      phasesByProject: { P: 1, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "Q",
    });
    expect(out).toBe(0);
  });

  it("activity transversal (sin assignment) con phases P=2, Q=1 → 2/3 a P, 1/3 a Q", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 3,
      assignmentProjectId: null,
      phasesByProject: { P: 2, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    const outQ = splitTransversalActivityHours({
      activityHours: 3,
      assignmentProjectId: null,
      phasesByProject: { P: 2, Q: 1 },
      testerProjectIds: ["P", "Q"],
      targetProjectId: "Q",
    });
    expect(outP).toBeCloseTo(2, 5);
    expect(outQ).toBeCloseTo(1, 5);
  });

  it("transversal y el tester no tiene phases activas → reparto equitativo entre testerProjectIds", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: null,
      phasesByProject: {},
      testerProjectIds: ["P", "Q"],
      targetProjectId: "P",
    });
    expect(outP).toBe(1);
  });

  it("transversal y el tester solo está en P → todo a P", () => {
    const outP = splitTransversalActivityHours({
      activityHours: 2,
      assignmentProjectId: null,
      phasesByProject: {},
      testerProjectIds: ["P"],
      targetProjectId: "P",
    });
    expect(outP).toBe(2);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: FAIL — `splitTransversalActivityHours is not a function`

- [ ] **Step 3: Implementar**

Añadir al final de `occupation-math.ts`:

```ts
export interface TransversalInput {
  activityHours: number;
  assignmentProjectId: string | null;   // null = transversal
  phasesByProject: Record<string, number>; // conteo de phases activas por proyecto ese día
  testerProjectIds: readonly string[];   // proyectos en los que el tester tiene Tester activo
  targetProjectId: string;
}

export function splitTransversalActivityHours(input: TransversalInput): number {
  const {
    activityHours,
    assignmentProjectId,
    phasesByProject,
    testerProjectIds,
    targetProjectId,
  } = input;

  if (activityHours <= 0) return 0;

  // Caso 1: Activity vinculada a un assignment de un proyecto específico.
  if (assignmentProjectId !== null) {
    return assignmentProjectId === targetProjectId ? activityHours : 0;
  }

  // Caso 2: Activity transversal (sin assignment).
  const totalPhases = Object.values(phasesByProject).reduce((s, n) => s + n, 0);
  if (totalPhases > 0) {
    const phasesInTarget = phasesByProject[targetProjectId] ?? 0;
    return activityHours * (phasesInTarget / totalPhases);
  }

  // Sin phases → reparto equitativo entre proyectos donde el tester está activo.
  if (!testerProjectIds.includes(targetProjectId)) return 0;
  return activityHours / testerProjectIds.length;
}
```

- [ ] **Step 4: Ejecutar y confirmar PASS**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: PASS 14/14

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/pptx/occupation-math.ts apps/api/src/__tests__/pptx-occupation-math.test.ts
git commit -m "feat(api): distribute transversal Activity hours across projects by phase weight"
```

---

## Task 7: TDD — agregación completa de la curva "siempre ocupados"

**Files:**
- Modify: `apps/api/src/__tests__/pptx-occupation-math.test.ts`
- Modify: `apps/api/src/lib/pptx/occupation-math.ts`

- [ ] **Step 1: Test de agregación por buckets**

Al final del archivo de test:

```ts
import { aggregateOccupationCurve } from "../lib/pptx/occupation-math.js";

describe("aggregateOccupationCurve (integración de formulas §5.1)", () => {
  it("proyecto con 1 tester, 5 días L-V, fase EXECUTION todo el tiempo, sin activities → banda EXECUTION=40h, resto=0", () => {
    const from = new Date(Date.UTC(2026, 3, 13)); // lunes
    const to = new Date(Date.UTC(2026, 3, 17, 23, 59, 59)); // viernes
    const out = aggregateOccupationCurve({
      projectId: "P",
      from,
      to,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [
        { testerId: "T1", projectId: "P", type: "EXECUTION", start: from, end: to },
      ],
      activities: [],
      holidaysMs: new Set(),
    });
    expect(out.buckets).toHaveLength(5);
    const byLabel = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(byLabel["Ejecución"]).toBeCloseTo(40, 5);
    expect(byLabel["Reunión con usuario"]).toBe(0);
    expect(byLabel["Productivas no imputadas"]).toBe(0);
  });

  it("proyecto con 1 tester, 1 día, 2h reunión con usuario + fase EXECUTION → EXECUTION=6h, reunión=2h", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const end = new Date(Date.UTC(2026, 3, 13, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: end,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [
        { testerId: "T1", projectId: "P", type: "EXECUTION", start: mon, end },
      ],
      activities: [
        {
          testerId: "T1",
          categoryName: "Reunión con usuario",
          assignmentProjectId: "P",
          start: new Date(Date.UTC(2026, 3, 13, 9)),
          end: new Date(Date.UTC(2026, 3, 13, 11)),
        },
      ],
      holidaysMs: new Set(),
    });
    const totals = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(totals["Ejecución"]).toBeCloseTo(6, 5);
    expect(totals["Reunión con usuario"]).toBeCloseTo(2, 5);
  });

  it("sin phases activas pero con productiveHours → banda 'Productivas no imputadas'", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const end = new Date(Date.UTC(2026, 3, 13, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: end,
      bucketing: "daily",
      testers: [{ id: "T1", allocation: 100, projectIdsActive: ["P"] }],
      phaseSegments: [],
      activities: [],
      holidaysMs: new Set(),
    });
    const totals = Object.fromEntries(out.bands.map((b) => [b.label, b.values.reduce((s, v) => s + v, 0)]));
    expect(totals["Productivas no imputadas"]).toBeCloseTo(8, 5);
    expect(totals["Ejecución"]).toBe(0);
  });

  it("capacityHours por bucket refleja la capacidad total del proyecto", () => {
    const mon = new Date(Date.UTC(2026, 3, 13));
    const fri = new Date(Date.UTC(2026, 3, 17, 23, 59, 59));
    const out = aggregateOccupationCurve({
      projectId: "P",
      from: mon,
      to: fri,
      bucketing: "daily",
      testers: [
        { id: "T1", allocation: 100, projectIdsActive: ["P"] },
        { id: "T2", allocation: 50, projectIdsActive: ["P"] },
      ],
      phaseSegments: [],
      activities: [],
      holidaysMs: new Set(),
    });
    // Cada día: capacity = 8h + 4h = 12h
    expect(out.buckets.every((b) => b.capacityHours === 12)).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: FAIL — `aggregateOccupationCurve is not a function`

- [ ] **Step 3: Implementar `aggregateOccupationCurve`**

Añadir al final de `occupation-math.ts`:

```ts
import type { ProjectOccupationCurve, OccupationBand, OccupationBucket } from "./types.js";
import { PALETTE } from "./theme.js";

export type BucketingMode = "daily" | "weekly" | "monthly";

export interface TesterRef {
  id: string;
  allocation: number;
  projectIdsActive: readonly string[];
}

export interface PhaseSegment {
  testerId: string;
  projectId: string;
  type: AssignmentPhaseType;
  start: Date;
  end: Date;
}

export interface ActivityRef {
  testerId: string;
  categoryName: string;             // exacto: "Reunión con usuario", "Reunión con desarrollo", "Inducción", "Capacitación"
  assignmentProjectId: string | null;
  start: Date;
  end: Date;
}

export interface AggregateInput {
  projectId: string;
  from: Date;
  to: Date;
  bucketing: BucketingMode;
  testers: readonly TesterRef[];
  phaseSegments: readonly PhaseSegment[];
  activities: readonly ActivityRef[];
  holidaysMs: Set<number>;
}

const BAND_ORDER = [
  "Análisis",
  "Diseño de pruebas",
  "Ejecución",
  "Reunión con usuario",
  "Reunión con desarrollo",
  "Inducción/Capacitación",
  "Productivas no imputadas",
] as const satisfies readonly OccupationBand["label"][];

const BAND_COLORS: Record<OccupationBand["label"], string> = {
  "Análisis": PALETTE.phaseAnalysis,
  "Diseño de pruebas": PALETTE.phaseDesign,
  "Ejecución": PALETTE.phaseExecution,
  "Reunión con usuario": PALETTE.activityUserMeeting,
  "Reunión con desarrollo": PALETTE.activityDevMeeting,
  "Inducción/Capacitación": PALETTE.activityInduction,
  "Productivas no imputadas": PALETTE.activityUnassigned,
};

const ACTIVITY_BAND_MAP: Record<string, OccupationBand["label"]> = {
  "Reunión con usuario": "Reunión con usuario",
  "Reunión con desarrollo": "Reunión con desarrollo",
  "Inducción": "Inducción/Capacitación",
  "Capacitación": "Inducción/Capacitación",
};

const PHASE_BAND_MAP: Record<AssignmentPhaseType, OccupationBand["label"]> = {
  ANALYSIS: "Análisis",
  TEST_DESIGN: "Diseño de pruebas",
  EXECUTION: "Ejecución",
};

function iterDays(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const endMs = to.getTime();
  while (cur.getTime() <= endMs) {
    out.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function bucketKey(day: Date, mode: BucketingMode): string {
  if (mode === "daily") return day.toISOString().slice(0, 10);
  if (mode === "weekly") {
    // lunes ISO
    const d = new Date(day.getTime());
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow - 1));
    return d.toISOString().slice(0, 10);
  }
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(key: string, mode: BucketingMode): string {
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (mode === "daily") {
    const d = new Date(`${key}T00:00:00Z`);
    const dow = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
    return `${dayNames[dow]} ${d.getUTCDate()}`;
  }
  if (mode === "weekly") {
    const d = new Date(`${key}T00:00:00Z`);
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getUTCDay() + 1) / 7);
    return `Sem ${isoWeek}`;
  }
  const [, m] = key.split("-");
  return monthNames[Number(m) - 1]!;
}

function hoursOverlapDay(start: Date, end: Date, day: Date): number {
  const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const a = Math.max(start.getTime(), dayStart);
  const b = Math.min(end.getTime(), dayEnd);
  if (b <= a) return 0;
  return (b - a) / 3600000;
}

function dateInSegment(seg: PhaseSegment, day: Date): boolean {
  const ds = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const de = ds + 24 * 3600 * 1000 - 1;
  return seg.start.getTime() <= de && seg.end.getTime() >= ds;
}

export function aggregateOccupationCurve(input: AggregateInput): ProjectOccupationCurve {
  const { projectId, from, to, bucketing, testers, phaseSegments, activities, holidaysMs } = input;
  const days = iterDays(from, to).filter((d) => {
    const dow = d.getUTCDay();
    return dow !== 0 && dow !== 6;
  });

  // Orden de buckets estable.
  const bucketKeys: string[] = [];
  const seen = new Set<string>();
  for (const d of days) {
    const k = bucketKey(d, bucketing);
    if (!seen.has(k)) { seen.add(k); bucketKeys.push(k); }
  }

  // Acumuladores.
  const bandTotals: Record<OccupationBand["label"], Record<string, number>> = Object.fromEntries(
    BAND_ORDER.map((b) => [b, Object.fromEntries(bucketKeys.map((k) => [k, 0]))]),
  ) as Record<OccupationBand["label"], Record<string, number>>;
  const capacityByBucket: Record<string, number> = Object.fromEntries(bucketKeys.map((k) => [k, 0]));

  for (const day of days) {
    const bKey = bucketKey(day, bucketing);

    for (const t of testers) {
      const cap = dailyCapacityHours(day, t.allocation, holidaysMs);
      if (cap === 0) continue;
      capacityByBucket[bKey]! += cap;

      // Phases activas del tester ese día (cualquier proyecto).
      const activePhases: PhaseRef[] = phaseSegments
        .filter((s) => s.testerId === t.id && dateInSegment(s, day))
        .map((s) => ({ type: s.type, projectId: s.projectId }));

      const phasesByProject: Record<string, number> = {};
      for (const p of activePhases) {
        phasesByProject[p.projectId] = (phasesByProject[p.projectId] ?? 0) + 1;
      }

      // Activity hours del tester ese día.
      let totalActivityHoursAllProjects = 0;
      let activityHoursToProject = 0;
      const activityHoursByBand: Record<OccupationBand["label"], number> = {
        "Análisis": 0, "Diseño de pruebas": 0, "Ejecución": 0,
        "Reunión con usuario": 0, "Reunión con desarrollo": 0,
        "Inducción/Capacitación": 0, "Productivas no imputadas": 0,
      };

      for (const a of activities) {
        if (a.testerId !== t.id) continue;
        const hrs = hoursOverlapDay(a.start, a.end, day);
        if (hrs === 0) continue;
        totalActivityHoursAllProjects += hrs;
        const toProject = splitTransversalActivityHours({
          activityHours: hrs,
          assignmentProjectId: a.assignmentProjectId,
          phasesByProject,
          testerProjectIds: t.projectIdsActive,
          targetProjectId: projectId,
        });
        activityHoursToProject += toProject;
        const bandLabel = ACTIVITY_BAND_MAP[a.categoryName];
        if (bandLabel) activityHoursByBand[bandLabel] += toProject;
      }

      // Horas productivas globales y reparto a fases del proyecto.
      const productive = Math.max(0, cap - totalActivityHoursAllProjects);
      const split = splitProductiveHoursAcrossPhases(
        productive,
        activePhases,
        projectId,
      );

      // Sumar bandas Activity al bucket.
      for (const [label, h] of Object.entries(activityHoursByBand)) {
        bandTotals[label as OccupationBand["label"]][bKey]! += h;
      }

      // Sumar bandas de fase.
      bandTotals["Análisis"][bKey]! += split.byPhase.ANALYSIS;
      bandTotals["Diseño de pruebas"][bKey]! += split.byPhase.TEST_DESIGN;
      bandTotals["Ejecución"][bKey]! += split.byPhase.EXECUTION;

      // Productivas no imputadas: si el tester tiene Tester en P pero no phases en P ni en otros proyectos.
      const phasesInP = phasesByProject[projectId] ?? 0;
      const phasesInOtherProjects = Object.entries(phasesByProject)
        .filter(([k]) => k !== projectId)
        .reduce((s, [, n]) => s + n, 0);
      if (t.projectIdsActive.includes(projectId) && phasesInP === 0 && phasesInOtherProjects === 0 && productive > 0) {
        bandTotals["Productivas no imputadas"][bKey]! += productive;
      }
    }
  }

  const buckets: OccupationBucket[] = bucketKeys.map((k) => ({
    label: bucketLabel(k, bucketing),
    capacityHours: Math.round((capacityByBucket[k] ?? 0) * 100) / 100,
  }));

  const bands: OccupationBand[] = BAND_ORDER.map((label) => ({
    label,
    colorHex: BAND_COLORS[label],
    values: bucketKeys.map((k) => Math.round((bandTotals[label]![k] ?? 0) * 100) / 100),
  }));

  return { buckets, bands };
}
```

- [ ] **Step 4: Ejecutar y confirmar PASS**

Run: `cd apps/api && npx vitest run src/__tests__/pptx-occupation-math.test.ts`
Expected: PASS 18/18

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/pptx/occupation-math.ts apps/api/src/__tests__/pptx-occupation-math.test.ts
git commit -m "feat(api): aggregate project-scoped occupation curve with band stacking"
```

---

## Task 8: Construir `report-data.ts` — carga de proyectos (scope-aware)

**Files:**
- Create: `apps/api/src/lib/pptx/report-data.ts`

- [ ] **Step 1: Implementar `loadScopedProjects`**

```ts
// apps/api/src/lib/pptx/report-data.ts
import { prisma } from "@qa-metrics/database";
import type { AuthRequest } from "../../middleware/auth.js";
import { isClientPm, isAnalyst, clientPmProjectIds, analystProjectIds } from "../access.js";

const ACTIVE_OR_UAT = [
  "REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY",
  "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT",
] as const;

export async function buildProjectScope(
  req: AuthRequest,
  clientIdFilter?: string,
): Promise<Record<string, unknown>> {
  const scope: Record<string, unknown> = {};
  if (isClientPm(req)) {
    scope.id = { in: await clientPmProjectIds(req.user!.id) };
  } else if (isAnalyst(req)) {
    scope.id = { in: await analystProjectIds(req.user!.id) };
  } else {
    scope.client = { userId: req.user!.id };
  }
  if (clientIdFilter) scope.clientId = clientIdFilter;
  return scope;
}

export async function loadScopedProjects(
  scope: Record<string, unknown>,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.project.findMany({
    where: {
      ...scope,
      stories: { some: { assignments: { some: { status: { in: [...ACTIVE_OR_UAT] } } } } },
    },
    select: {
      id: true,
      name: true,
      client: { select: { id: true, name: true } },
      projectManager: { select: { name: true } },
      testers: {
        select: { id: true, name: true, allocation: true, userId: true },
        orderBy: { allocation: "desc" },
      },
      stories: {
        select: {
          id: true,
          externalId: true,
          title: true,
          designComplexity: true,
          executionComplexity: true,
          cycles: { select: { id: true } },
          assignments: {
            where: { status: { in: [...ACTIVE_OR_UAT] } },
            select: {
              id: true,
              status: true,
              testerId: true,
              phases: {
                select: { phase: true, startDate: true, endDate: true },
              },
              dailyRecords: {
                where: { date: { gte: periodStart, lte: periodEnd } },
                select: { date: true, designed: true, executed: true, defects: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type LoadedProject = Awaited<ReturnType<typeof loadScopedProjects>>[number];
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/report-data.ts`
Expected: sin errores (puede advertir sobre `any` — aceptable en este paso)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/report-data.ts
git commit -m "feat(api): add scope-aware project loader for PPTX reports"
```

---

## Task 9: Construir `report-data.ts` — agregación a `ReportSpec`

**Files:**
- Modify: `apps/api/src/lib/pptx/report-data.ts`

- [ ] **Step 1: Implementar `buildReportSpec` que ensambla todo**

Añadir al final de `report-data.ts`:

```ts
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, getISOWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { loadHolidaySet } from "../workdays.js";
import { computeOccupationBatch } from "../occupation.js";
import {
  aggregateOccupationCurve,
  type BucketingMode,
  type PhaseSegment,
  type ActivityRef,
  type TesterRef,
} from "./occupation-math.js";
import type {
  ReportSpec,
  ReportPeriod,
  ProjectReportData,
  HuRow,
  ComplexityBubble,
  ProjectPipeline,
  PortfolioTrendPoint,
  ComplexityLevel,
} from "./types.js";
import { PALETTE } from "./theme.js";

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "No Iniciado",
  ANALYSIS: "En Diseño",
  TEST_DESIGN: "En Diseño",
  WAITING_QA_DEPLOY: "Pdte. Instalación QA",
  EXECUTION: "En Curso",
  RETURNED_TO_DEV: "Devuelto a Desarrollo",
  WAITING_UAT: "Pdte. Aprobación",
  UAT: "Pdte. Aprobación",
  PRODUCTION: "Completado",
  ON_HOLD: "Detenido",
};

const STATUS_COLOR: Record<string, string> = {
  "No Iniciado": PALETTE.textMuted,
  "En Diseño": PALETTE.phaseDesign,
  "Pdte. Instalación QA": PALETTE.amber,
  "En Curso": PALETTE.greenPrimary,
  "Devuelto a Desarrollo": PALETTE.red,
  "Pdte. Aprobación": PALETTE.purple,
  "Completado": PALETTE.greenPrimary,
  "Detenido": PALETTE.textMuted,
};

export interface BuildSpecInput {
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  scope: Record<string, unknown>;
  clientFilter: { id: string; name: string } | null;
  userRole: string;
}

function bucketingFor(period: ReportPeriod): BucketingMode {
  if (period === "weekly") return "daily";
  if (period === "monthly") return "weekly";
  return "monthly";
}

function periodLabel(period: ReportPeriod, start: Date, end: Date): string {
  if (period === "weekly") {
    const d1 = format(start, "d", { locale: es });
    const d2 = format(end, "d", { locale: es });
    const m = format(end, "MMMM yyyy", { locale: es });
    return `Semana del ${d1} al ${d2} de ${m}`;
  }
  if (period === "monthly") return format(start, "MMMM yyyy", { locale: es });
  return `Año ${format(start, "yyyy")}`;
}

export async function buildReportSpec(input: BuildSpecInput): Promise<ReportSpec> {
  const { period, periodStart, periodEnd, scope, clientFilter, userRole } = input;

  const loaded = await loadScopedProjects(scope, periodStart, periodEnd);
  const holidaysMs = new Set(
    Array.from(await loadHolidaySet(periodStart, periodEnd)).map((ms) => ms),
  );

  // Pre-calcular mapping tester → proyectos activos (para split transversal).
  const testerToProjects = new Map<string, string[]>();
  for (const p of loaded) {
    for (const t of p.testers) {
      const arr = testerToProjects.get(t.id) ?? [];
      if (!arr.includes(p.id)) arr.push(p.id);
      testerToProjects.set(t.id, arr);
    }
  }

  const testerIds = Array.from(testerToProjects.keys());

  // Todas las activities del periodo para esos testers.
  const activitiesRaw = testerIds.length === 0 ? [] : await prisma.activity.findMany({
    where: {
      testerId: { in: testerIds },
      startAt: { lt: periodEnd },
      endAt: { gt: periodStart },
    },
    include: {
      category: { select: { name: true } },
      assignment: { select: { story: { select: { projectId: true } } } },
    },
  });

  const activitiesByTester = new Map<string, ActivityRef[]>();
  for (const a of activitiesRaw) {
    const list = activitiesByTester.get(a.testerId) ?? [];
    list.push({
      testerId: a.testerId,
      categoryName: a.category.name,
      assignmentProjectId: a.assignment?.story?.projectId ?? null,
      start: a.startAt,
      end: a.endAt,
    });
    activitiesByTester.set(a.testerId, list);
  }

  // Armar ProjectReportData para cada proyecto.
  const projects: ProjectReportData[] = loaded.map((p) => {
    const testersRefs: TesterRef[] = p.testers.map((t) => ({
      id: t.id,
      allocation: t.allocation,
      projectIdsActive: testerToProjects.get(t.id) ?? [p.id],
    }));

    // Phase segments de este proyecto y de OTROS proyectos (para los testers compartidos).
    const phaseSegments: PhaseSegment[] = [];
    for (const story of p.stories) {
      for (const a of story.assignments) {
        for (const ph of a.phases) {
          phaseSegments.push({
            testerId: a.testerId,
            projectId: p.id,
            type: ph.phase,
            start: ph.startDate,
            end: ph.endDate,
          });
        }
      }
    }
    // Añadir phases de otros proyectos para los testers compartidos.
    for (const t of p.testers) {
      const otherProjects = (testerToProjects.get(t.id) ?? []).filter((pid) => pid !== p.id);
      for (const other of otherProjects) {
        const otherProj = loaded.find((pp) => pp.id === other);
        if (!otherProj) continue;
        for (const story of otherProj.stories) {
          for (const a of story.assignments) {
            if (a.testerId !== t.id) continue;
            for (const ph of a.phases) {
              phaseSegments.push({
                testerId: t.id,
                projectId: other,
                type: ph.phase,
                start: ph.startDate,
                end: ph.endDate,
              });
            }
          }
        }
      }
    }

    // Activities: unir las de todos los testers del proyecto.
    const activitiesForProject: ActivityRef[] = [];
    for (const t of p.testers) {
      for (const a of activitiesByTester.get(t.id) ?? []) {
        activitiesForProject.push(a);
      }
    }

    const curve = aggregateOccupationCurve({
      projectId: p.id,
      from: periodStart,
      to: periodEnd,
      bucketing: bucketingFor(period),
      testers: testersRefs,
      phaseSegments,
      activities: activitiesForProject,
      holidaysMs,
    });

    // HU rows + bubbles + KPIs
    const hus: HuRow[] = [];
    const bubbles: ComplexityBubble[] = [];
    const pipelineMap = new Map<string, number>();
    let designed = 0, executed = 0, defects = 0;

    for (const s of p.stories.filter((st) => st.assignments.length > 0)) {
      const flat = s.assignments.flatMap((a) => a.dailyRecords);
      const sd = flat.reduce((acc, r) => acc + r.designed, 0);
      const se = flat.reduce((acc, r) => acc + r.executed, 0);
      const sb = flat.reduce((acc, r) => acc + r.defects, 0);
      designed += sd; executed += se; defects += sb;

      const statusInternal = s.assignments[0]?.status ?? "REGISTERED";
      const statusLbl = STATUS_LABEL[statusInternal] ?? statusInternal;
      pipelineMap.set(statusLbl, (pipelineMap.get(statusLbl) ?? 0) + 1);

      hus.push({
        storyId: s.id,
        externalId: s.externalId,
        title: s.title,
        regressionNumber: s.cycles.length,
        designComplexity: s.designComplexity as ComplexityLevel,
        executionComplexity: s.executionComplexity as ComplexityLevel,
        status: statusInternal,
        statusLabel: statusLbl,
        designed: sd,
        executed: se,
        defects: sb,
      });

      bubbles.push({
        storyId: s.id,
        title: s.externalId ? `${s.externalId} — ${s.title}` : s.title,
        designComplexity: s.designComplexity as ComplexityLevel,
        executionComplexity: s.executionComplexity as ComplexityLevel,
        size: sd + se,
        statusLabel: statusLbl,
      });
    }

    const pipeline: ProjectPipeline[] = Array.from(pipelineMap.entries()).map(([label, count]) => ({
      label,
      count,
      colorHex: STATUS_COLOR[label] ?? PALETTE.textMuted,
    }));

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      projectManagerName: p.projectManager?.name ?? null,
      testers: p.testers.map((t) => ({ id: t.id, name: t.name, allocation: t.allocation })),
      kpis: { designed, executed, defects },
      pipeline,
      hus,
      complexityBubbles: bubbles,
      occupationCurve: curve,
    };
  });

  // Portfolio KPIs.
  const portD = projects.reduce((s, p) => s + p.kpis.designed, 0);
  const portE = projects.reduce((s, p) => s + p.kpis.executed, 0);
  const portB = projects.reduce((s, p) => s + p.kpis.defects, 0);
  const ratioPct = portD > 0 ? Math.round((portE / portD) * 100) : 0;

  // HUs por nº regresiones (en el portfolio).
  let husFirstCycle = 0;
  let husMultipleCycles = 0;
  for (const p of projects) {
    for (const h of p.hus) {
      if (h.regressionNumber <= 1) husFirstCycle++;
      else husMultipleCycles++;
    }
  }

  // Capacidad utilizada total: suma bandas curvas / suma capacidad.
  let totalBands = 0;
  let totalCapacity = 0;
  for (const p of projects) {
    for (const b of p.occupationCurve.buckets) totalCapacity += b.capacityHours;
    for (const band of p.occupationCurve.bands) {
      for (const v of band.values) totalBands += v;
    }
  }
  const capacityUtilizationPct = totalCapacity > 0
    ? Math.round((totalBands / totalCapacity) * 100)
    : 0;

  // Pipeline consolidado.
  const portPipelineMap = new Map<string, ProjectPipeline>();
  for (const p of projects) {
    for (const it of p.pipeline) {
      const cur = portPipelineMap.get(it.label) ?? { label: it.label, count: 0, colorHex: it.colorHex };
      cur.count += it.count;
      portPipelineMap.set(it.label, cur);
    }
  }

  // Comparativa por proyecto.
  const comparison = projects.map((p) => ({
    projectName: p.projectName,
    designed: p.kpis.designed,
    executed: p.kpis.executed,
  }));

  // Trend del portfolio (mismo bucketing que la curva).
  const trend = await buildPortfolioTrend(period, periodStart, periodEnd, scope, clientFilter?.id);

  // Ocupación por analista (anexo interno).
  let analysts: Awaited<ReturnType<typeof computeOccupationBatch>> = [];
  const includeInternalAppendix = userRole !== "CLIENT_PM";
  if (includeInternalAppendix && testerIds.length > 0) {
    if (userRole === "QA_ANALYST") {
      // Solo su propio Tester.
      const mine = await prisma.tester.findMany({
        where: { id: { in: testerIds }, user: { is: { id: { not: undefined } } } },
        select: { id: true, userId: true },
      });
      const myTesterIds = mine
        .filter((m) => m.userId === input.scope["_userId"])
        .map((m) => m.id);
      analysts = await computeOccupationBatch(myTesterIds, periodStart, periodEnd);
    } else {
      analysts = await computeOccupationBatch(testerIds, periodStart, periodEnd);
    }
  }

  const totalAnalysts = new Set(projects.flatMap((p) => p.testers.map((t) => t.id))).size;

  return {
    period,
    periodStart,
    periodEnd,
    periodLabel: periodLabel(period, periodStart, periodEnd),
    clientFilter,
    projects,
    analysts,
    portfolio: {
      kpis: {
        designed: portD,
        executed: portE,
        defects: portB,
        ratioPct,
        husFirstCycle,
        husMultipleCycles,
        capacityUtilizationPct,
        totalProjects: projects.length,
        totalAnalysts,
      },
      pipeline: Array.from(portPipelineMap.values()),
      comparison,
      trend,
    },
    includeInternalAppendix,
  };
}

async function buildPortfolioTrend(
  period: ReportPeriod,
  periodStart: Date,
  periodEnd: Date,
  scope: Record<string, unknown>,
  clientId?: string,
): Promise<PortfolioTrendPoint[]> {
  const records = await prisma.dailyRecord.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      tester: { project: clientId ? { ...scope, clientId } : scope },
    },
    select: { date: true, designed: true, executed: true, defects: true },
    orderBy: { date: "asc" },
  });

  const bucket = bucketingFor(period);
  const buckets = new Map<string, PortfolioTrendPoint>();
  for (const r of records) {
    let key: string;
    let label: string;
    if (bucket === "daily") {
      key = r.date.toISOString().slice(0, 10);
      const dow = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][r.date.getUTCDay()]!;
      label = `${dow} ${r.date.getUTCDate()}`;
    } else if (bucket === "weekly") {
      const ws = startOfWeek(r.date, { weekStartsOn: 1 });
      key = ws.toISOString().slice(0, 10);
      label = `Sem ${getISOWeek(ws)}`;
    } else {
      key = format(r.date, "yyyy-MM");
      label = format(r.date, "MMM", { locale: es });
    }
    const cur = buckets.get(key) ?? { label, designed: 0, executed: 0, defects: 0 };
    cur.designed += r.designed;
    cur.executed += r.executed;
    cur.defects += r.defects;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/report-data.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/report-data.ts
git commit -m "feat(api): aggregate Prisma data into ReportSpec for PPTX module"
```

---

## Task 10: Chart PNG — curva "siempre ocupados" (stacked area)

**Files:**
- Create: `apps/api/src/lib/pptx/charts/occupation-chart.ts`

- [ ] **Step 1: Implementar el generador**

```ts
// apps/api/src/lib/pptx/charts/occupation-chart.ts
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ProjectOccupationCurve } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const WIDTH = 1600;
const HEIGHT = 720;
const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#FFFFFF",
});

export async function buildOccupationChart(
  curve: ProjectOccupationCurve,
  projectName: string,
): Promise<Buffer> {
  const capacityLine = curve.buckets.map((b) => b.capacityHours);

  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: curve.buckets.map((b) => b.label),
      datasets: [
        ...curve.bands.map((band) => ({
          label: band.label,
          data: band.values,
          backgroundColor: `#${band.colorHex}`,
          borderColor: `#${band.colorHex}`,
          fill: true,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.25,
          stack: "occupation",
        })),
        {
          label: "Capacidad contratada",
          data: capacityLine,
          borderColor: `#${PALETTE.textPrimary}`,
          borderDash: [6, 6],
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: `#${PALETTE.textPrimary}`,
          borderWidth: 2,
          stack: "guide",
          tension: 0,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: [`Capacidad ocupada — ${projectName}`, "El equipo permanece siempre productivo"],
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 12, bottom: 18 },
        },
        legend: {
          position: "right",
          labels: {
            font: { size: 13, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            padding: 10,
            boxWidth: 18,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` },
          grid: { display: false },
          stacked: false,
        },
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}`, callback: (v) => `${v} h` },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/charts/occupation-chart.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/charts/occupation-chart.ts
git commit -m "feat(api): render stacked-area occupation chart with Inovabiz palette"
```

---

## Task 11: Chart PNG — matriz de complejidad (bubble 3×3)

**Files:**
- Create: `apps/api/src/lib/pptx/charts/complexity-matrix.ts`

- [ ] **Step 1: Implementar el bubble chart**

```ts
// apps/api/src/lib/pptx/charts/complexity-matrix.ts
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ComplexityBubble, ComplexityLevel } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const WIDTH = 1200;
const HEIGHT = 800;
const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#FFFFFF",
});

const LEVELS: ComplexityLevel[] = ["LOW", "MEDIUM", "HIGH"];

function levelToAxis(l: ComplexityLevel): number {
  return LEVELS.indexOf(l) + 1;
}

function jitter(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 200) / 1000) - 0.1; // ±0.1
}

export async function buildComplexityMatrix(bubbles: ComplexityBubble[]): Promise<Buffer> {
  const minSize = 8;
  const maxSize = 52;
  const maxVal = Math.max(...bubbles.map((b) => b.size), 1);
  const points = bubbles.map((b) => ({
    x: levelToAxis(b.designComplexity) + jitter(b.storyId),
    y: levelToAxis(b.executionComplexity) + jitter(`${b.storyId}y`),
    r: Math.max(minSize, (b.size / maxVal) * maxSize),
    label: b.title,
  }));

  const config: ChartConfiguration<"bubble"> = {
    type: "bubble",
    data: {
      datasets: [
        {
          label: "HUs",
          data: points,
          backgroundColor: `rgba(8, 172, 244, 0.55)`,
          borderColor: `#${PALETTE.blue}`,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Matriz de complejidad por HU (Diseño × Ejecución)",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 12, bottom: 18 },
        },
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          min: 0.5, max: 3.5,
          ticks: {
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            callback: (v) => LEVELS[Number(v) - 1] ?? "",
            stepSize: 1,
          },
          title: {
            display: true,
            text: "Complejidad de Diseño",
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
          },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
        y: {
          min: 0.5, max: 3.5,
          ticks: {
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            callback: (v) => LEVELS[Number(v) - 1] ?? "",
            stepSize: 1,
          },
          title: {
            display: true,
            text: "Complejidad de Ejecución",
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
          },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/charts/complexity-matrix.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/charts/complexity-matrix.ts
git commit -m "feat(api): render 3x3 complexity bubble matrix with jitter"
```

---

## Task 12: Chart PNG — pipeline donut + comparación bars + trend line

**Files:**
- Create: `apps/api/src/lib/pptx/charts/portfolio-charts.ts`

- [ ] **Step 1: Implementar los tres charts consolidados**

```ts
// apps/api/src/lib/pptx/charts/portfolio-charts.ts
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ProjectPipeline, PortfolioTrendPoint } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;
const canvas = new ChartJSNodeCanvas({ width: 1400, height: 720, backgroundColour: "#FFFFFF" });

export async function buildPipelineDonut(pipeline: ProjectPipeline[]): Promise<Buffer> {
  const filtered = pipeline.filter((p) => p.count > 0);
  const cfg: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: filtered.map((p) => p.label),
      datasets: [{
        data: filtered.map((p) => p.count),
        backgroundColor: filtered.map((p) => `#${p.colorHex}`),
        borderColor: "#FFFFFF",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true, text: "Pipeline global por estado (HUs)",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: {
          position: "right",
          labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}`, padding: 12 },
        },
      },
      cutout: "55%",
    },
  };
  return canvas.renderToBuffer(cfg, "image/png");
}

export async function buildComparisonBars(
  data: Array<{ projectName: string; designed: number; executed: number }>,
): Promise<Buffer> {
  const cfg: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: data.map((d) => d.projectName),
      datasets: [
        {
          label: "Diseñados",
          data: data.map((d) => d.designed),
          backgroundColor: `#${PALETTE.blue}`,
          borderRadius: 6,
        },
        {
          label: "Ejecutados",
          data: data.map((d) => d.executed),
          backgroundColor: `#${PALETTE.greenPrimary}`,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true, text: "Diseñados vs Ejecutados por proyecto",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: { position: "top", labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` } },
      },
      scales: {
        x: { ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}`, maxRotation: 35 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}` }, grid: { color: "rgba(107,114,128,0.18)" } },
      },
    },
  };
  return canvas.renderToBuffer(cfg, "image/png");
}

export async function buildTrendLine(trend: PortfolioTrendPoint[]): Promise<Buffer> {
  let cD = 0, cE = 0, cB = 0;
  const cumD = trend.map((p) => (cD += p.designed, cD));
  const cumE = trend.map((p) => (cE += p.executed, cE));
  const cumB = trend.map((p) => (cB += p.defects, cB));

  const cfg: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: trend.map((p) => p.label),
      datasets: [
        { label: "Diseñados (acum.)", data: cumD, borderColor: `#${PALETTE.blue}`, backgroundColor: "rgba(8,172,244,0.15)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
        { label: "Ejecutados (acum.)", data: cumE, borderColor: `#${PALETTE.greenPrimary}`, backgroundColor: "rgba(37,207,108,0.15)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
        { label: "Defectos (acum.)", data: cumB, borderColor: `#${PALETTE.red}`, backgroundColor: "rgba(239,68,68,0.10)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true, text: "Tendencia acumulada del portafolio",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: { position: "top", labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` } },
      },
      scales: {
        x: { ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` }, grid: { color: "rgba(107,114,128,0.10)" } },
        y: { beginAtZero: true, ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}` }, grid: { color: "rgba(107,114,128,0.18)" } },
      },
    },
  };
  return canvas.renderToBuffer(cfg, "image/png");
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/charts/portfolio-charts.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/charts/portfolio-charts.ts
git commit -m "feat(api): add portfolio pipeline/comparison/trend charts"
```

---

## Task 13: Slide — Portada y Cierre

**Files:**
- Create: `apps/api/src/lib/pptx/slides/cover.ts`
- Create: `apps/api/src/lib/pptx/slides/closing.ts`

- [ ] **Step 1: Implementar `cover.ts`**

```ts
// apps/api/src/lib/pptx/slides/cover.ts
import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGO_PATH = join(__dirname, "..", "..", "..", "assets", "inovabiz-logo.svg");

export function addCoverSlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };

  // Franja vertical gradiente verde (simulada con rect solid + rect con color claro).
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE.heightIn,
    fill: { color: PALETTE.greenPrimary },
    line: { type: "none" },
  });

  // Logo Inovabiz (SVG convertido a data URI).
  const svg = readFileSync(LOGO_PATH, "utf-8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.9, y: 0.5, w: 2.4, h: 0.29 });

  // Marca "QA Metrics by Inovabiz" al lado del logo.
  s.addText("QA Metrics by Inovabiz", {
    x: 0.9, y: 0.9, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.cyan,
    charSpacing: 1,
  });

  // Título.
  s.addText("Informe de Avance QA", {
    x: 0.9, y: 2.2, w: SLIDE.widthIn - 1.8, h: 1.0,
    fontFace: FONT.face, fontSize: 44, bold: true, color: PALETTE.white,
  });

  // Subtítulo: periodo.
  s.addText(spec.periodLabel, {
    x: 0.9, y: 3.3, w: SLIDE.widthIn - 1.8, h: 0.7,
    fontFace: FONT.face, fontSize: 24, color: PALETTE.grayLight,
  });

  // Cliente (si aplica).
  if (spec.clientFilter) {
    s.addText(`Cliente: ${spec.clientFilter.name}`, {
      x: 0.9, y: 4.3, w: SLIDE.widthIn - 1.8, h: 0.5,
      fontFace: FONT.face, fontSize: 16, color: PALETTE.cyan,
    });
  }

  // Footer.
  s.addText("Preparado por Inovabiz", {
    x: 0.9, y: SLIDE.heightIn - 0.8, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.greenLight,
  });
  s.addText(new Date().toLocaleDateString("es-CL"), {
    x: SLIDE.widthIn - 2.5, y: SLIDE.heightIn - 0.8, w: 2, h: 0.4,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.grayLight, align: "right",
  });
}
```

- [ ] **Step 2: Implementar `closing.ts`**

```ts
// apps/api/src/lib/pptx/slides/closing.ts
import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGO_PATH = join(__dirname, "..", "..", "..", "assets", "inovabiz-logo.svg");

export function addClosingSlide(pres: PptxGenJS): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };

  const svg = readFileSync(LOGO_PATH, "utf-8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  s.addImage({ data: dataUri, x: (SLIDE.widthIn - 4) / 2, y: 2.3, w: 4, h: 0.49 });

  // Marca "QA Metrics by Inovabiz" bajo el logo.
  s.addText("QA Metrics by Inovabiz", {
    x: 0, y: 2.95, w: SLIDE.widthIn, h: 0.4,
    fontFace: FONT.face, fontSize: 16, bold: true, color: PALETTE.greenLight, align: "center",
    charSpacing: 1,
  });

  s.addText("Gracias", {
    x: 0, y: 3.8, w: SLIDE.widthIn, h: 1,
    fontFace: FONT.face, fontSize: 56, bold: true, color: PALETTE.white, align: "center",
  });
  s.addText("contacto@inovabiz.com · inovabiz.com", {
    x: 0, y: 5.0, w: SLIDE.widthIn, h: 0.5,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.cyan, align: "center",
  });
}
```

- [ ] **Step 3: Typecheck ambos archivos**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/cover.ts src/lib/pptx/slides/closing.ts`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/pptx/slides/cover.ts apps/api/src/lib/pptx/slides/closing.ts
git commit -m "feat(api): add cover and closing slides with Inovabiz branding"
```

---

## Task 14: Slide — Resumen ejecutivo

**Files:**
- Create: `apps/api/src/lib/pptx/slides/executive-summary.ts`

- [ ] **Step 1: Implementar**

```ts
// apps/api/src/lib/pptx/slides/executive-summary.ts
import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

function kpiCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  value: string, label: string, accentHex: string,
): void {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: PALETTE.white },
    line: { color: accentHex, width: 2 },
    rectRadius: 0.08,
    shadow: { type: "outer", color: "6B7280", opacity: 0.18, offset: 2, blur: 6, angle: 90 },
  });
  slide.addText(value, {
    x, y: y + 0.15, w, h: h * 0.55,
    fontFace: FONT.face, fontSize: 40, bold: true, color: accentHex, align: "center",
  });
  slide.addText(label, {
    x, y: y + h * 0.65, w, h: h * 0.3,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
  });
}

export function addExecutiveSummarySlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.9,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  });
  s.addText("Resumen ejecutivo", {
    x: 0.5, y: 0.2, w: 10, h: 0.5,
    fontFace: FONT.face, fontSize: 22, bold: true, color: PALETTE.white,
  });
  s.addText(spec.periodLabel, {
    x: SLIDE.widthIn - 4.5, y: 0.25, w: 4, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight, align: "right",
  });

  // 4 KPI cards.
  const cardW = 2.85;
  const gap = 0.2;
  const startX = (SLIDE.widthIn - (4 * cardW + 3 * gap)) / 2;
  const y = 1.3;
  const k = spec.portfolio.kpis;
  kpiCard(pres, s, startX + 0 * (cardW + gap), y, cardW, 1.7, String(k.designed), "Casos Diseñados", `#${PALETTE.blue}`);
  kpiCard(pres, s, startX + 1 * (cardW + gap), y, cardW, 1.7, String(k.executed), "Casos Ejecutados", `#${PALETTE.greenPrimary}`);
  kpiCard(pres, s, startX + 2 * (cardW + gap), y, cardW, 1.7, String(k.defects), "Defectos Detectados", `#${PALETTE.red}`);
  kpiCard(pres, s, startX + 3 * (cardW + gap), y, cardW, 1.7, `${k.ratioPct}%`, "Ratio Ejec / Dis", `#${PALETTE.cyan}`);

  // Narrativa de regresiones + capacidad.
  const nY = 3.4;
  const mini = [
    { v: String(k.husFirstCycle), l: "HUs completadas en 1ª regresión", color: PALETTE.greenPrimary },
    { v: String(k.husMultipleCycles), l: "HUs con 2+ regresiones (devoluciones de desarrollo)", color: PALETTE.amber },
    { v: `${k.capacityUtilizationPct}%`, l: "Capacidad del equipo utilizada", color: PALETTE.cyan },
  ];
  const miniW = (SLIDE.widthIn - 1.0) / 3;
  mini.forEach((m, i) => {
    const x = 0.5 + i * miniW;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: nY, w: miniW - 0.15, h: 1.3,
      fill: { color: PALETTE.white }, line: { color: m.color, width: 1 },
    });
    s.addText(m.v, {
      x, y: nY + 0.1, w: miniW - 0.15, h: 0.7,
      fontFace: FONT.face, fontSize: 34, bold: true, color: `#${m.color}`, align: "center",
    });
    s.addText(m.l, {
      x, y: nY + 0.82, w: miniW - 0.15, h: 0.45,
      fontFace: FONT.face, fontSize: 11, color: PALETTE.textMuted, align: "center",
    });
  });

  // Footer contextual.
  s.addText(
    `${k.totalProjects} proyectos · ${k.totalAnalysts} analistas · Periodo: ${spec.periodLabel}`,
    { x: 0.5, y: 5.3, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center" },
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/executive-summary.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/slides/executive-summary.ts
git commit -m "feat(api): add executive summary slide with KPI cards and regression narrative"
```

---

## Task 15: Slide — Portada y Tabla HU del proyecto

**Files:**
- Create: `apps/api/src/lib/pptx/slides/project-cover.ts`
- Create: `apps/api/src/lib/pptx/slides/project-hu-table.ts`

- [ ] **Step 1: Implementar `project-cover.ts`**

```ts
// apps/api/src/lib/pptx/slides/project-cover.ts
import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addProjectCoverSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header navy.
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 1.3,
    fill: { color: PALETTE.navyDeep }, line: { type: "none" },
  });
  s.addText(p.projectName, {
    x: 0.5, y: 0.25, w: SLIDE.widthIn - 6, h: 0.6,
    fontFace: FONT.face, fontSize: 28, bold: true, color: PALETTE.white,
  });
  s.addText(`Cliente: ${p.clientName}`, {
    x: 0.5, y: 0.82, w: SLIDE.widthIn - 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight,
  });
  s.addText(`PM: ${p.projectManagerName ?? "—"}`, {
    x: SLIDE.widthIn - 5, y: 0.25, w: 4.5, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.white, align: "right",
  });
  s.addText(
    p.testers.map((t) => `${t.name} (${t.allocation}%)`).join(" · ") || "—",
    { x: SLIDE.widthIn - 5, y: 0.75, w: 4.5, h: 0.45, fontFace: FONT.face, fontSize: 12, color: PALETTE.cyan, align: "right" },
  );

  // 3 KPI cards.
  const kpis = [
    { v: String(p.kpis.designed), l: "Diseñados", c: PALETTE.blue },
    { v: String(p.kpis.executed), l: "Ejecutados", c: PALETTE.greenPrimary },
    { v: String(p.kpis.defects), l: "Defectos", c: PALETTE.red },
  ];
  const cardW = 3.5;
  const startX = (SLIDE.widthIn - (3 * cardW + 2 * 0.25)) / 2;
  const y = 1.8;
  kpis.forEach((kp, i) => {
    const x = startX + i * (cardW + 0.25);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: 2,
      fill: { color: PALETTE.white }, line: { color: kp.c, width: 2 }, rectRadius: 0.1,
    });
    s.addText(kp.v, {
      x, y: y + 0.3, w: cardW, h: 1.2,
      fontFace: FONT.face, fontSize: 56, bold: true, color: `#${kp.c}`, align: "center",
    });
    s.addText(kp.l, {
      x, y: y + 1.5, w: cardW, h: 0.4,
      fontFace: FONT.face, fontSize: 14, color: PALETTE.textMuted, align: "center",
    });
  });

  // Mini-pipeline (barras horizontales estilo "chip strip").
  const stripY = 4.3;
  const totalC = p.pipeline.reduce((s, q) => s + q.count, 0) || 1;
  let cursor = 0.5;
  const stripW = SLIDE.widthIn - 1;
  s.addText("Pipeline del proyecto", {
    x: 0.5, y: stripY - 0.5, w: stripW, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  for (const item of p.pipeline) {
    const w = (item.count / totalC) * stripW;
    s.addShape(pres.shapes.RECTANGLE, {
      x: cursor, y: stripY, w, h: 0.5,
      fill: { color: item.colorHex }, line: { color: "FFFFFF", width: 1 },
    });
    s.addText(`${item.label} (${item.count})`, {
      x: cursor, y: stripY + 0.55, w, h: 0.4,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, align: "center",
    });
    cursor += w;
  }
}
```

- [ ] **Step 2: Implementar `project-hu-table.ts`**

```ts
// apps/api/src/lib/pptx/slides/project-hu-table.ts
import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData, HuRow, ComplexityLevel } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

function regressionChip(n: number): { label: string; color: string } {
  if (n <= 1) return { label: "R1", color: PALETTE.textMuted };
  if (n === 2) return { label: "R2", color: PALETTE.amber };
  return { label: `R${n}`, color: PALETTE.red };
}

function complexityColor(c: ComplexityLevel): string {
  if (c === "HIGH") return PALETTE.red;
  if (c === "MEDIUM") return PALETTE.amber;
  return PALETTE.greenPrimary;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function addProjectHuTableSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  });
  s.addText(`Detalle por Historia de Usuario — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  // Construir tabla. Columnas: HU | R# | CD | CE | Estado | Dis | Eje | Def
  const header = ["Historia de Usuario", "R#", "Dis.", "Ejec.", "Estado", "Dis.", "Ejec.", "Def."];
  const colW = [4.3, 0.7, 0.9, 0.9, 2.1, 0.9, 0.9, 0.9]; // suma = 11.6

  const rows: Array<Array<{
    text: string;
    options: PptxGenJS.TableCellProps;
  }>> = [];

  // Header row.
  rows.push(header.map((h, i) => ({
    text: h,
    options: {
      bold: true, color: PALETTE.white, fontSize: 11, fontFace: FONT.face,
      align: i === 0 ? "left" : "center",
      fill: { color: PALETTE.navyUi },
      margin: 0.05,
    },
  })));

  // Orden HUs: por regresión desc, luego título.
  const sorted = [...p.hus].sort((a, b) => (b.regressionNumber - a.regressionNumber) || a.title.localeCompare(b.title));

  for (const h of sorted) {
    const chip = regressionChip(h.regressionNumber);
    const cdc = complexityColor(h.designComplexity);
    const cec = complexityColor(h.executionComplexity);
    const huText = (h.externalId ? `${h.externalId} · ` : "") + truncate(h.title, 60);
    rows.push([
      { text: huText, options: { fontSize: 10, fontFace: FONT.face, color: PALETTE.textPrimary, margin: 0.05 } },
      { text: chip.label, options: { fontSize: 10, bold: true, color: PALETTE.white, fill: { color: chip.color }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.designComplexity, options: { fontSize: 9, color: PALETTE.white, fill: { color: cdc }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.executionComplexity, options: { fontSize: 9, color: PALETTE.white, fill: { color: cec }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.statusLabel, options: { fontSize: 9, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.designed), options: { fontSize: 10, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.executed), options: { fontSize: 10, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.defects), options: { fontSize: 10, color: h.defects > 0 ? PALETTE.red : PALETTE.textMuted, align: "center", bold: h.defects > 0, fontFace: FONT.face, margin: 0.05 } },
    ]);
  }

  if (sorted.length === 0) {
    rows.push([{
      text: "(Sin HUs con actividad en el periodo)",
      options: { fontSize: 11, italic: true, color: PALETTE.textMuted, colspan: 8, align: "center", fontFace: FONT.face },
    }]);
  }

  s.addTable(rows as any, {
    x: 0.4, y: 1.0, w: 12.5, colW,
    border: { type: "solid", pt: 0.5, color: "E5E7EB" },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/project-cover.ts src/lib/pptx/slides/project-hu-table.ts`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/pptx/slides/project-cover.ts apps/api/src/lib/pptx/slides/project-hu-table.ts
git commit -m "feat(api): add project cover slide and HU detail table with regression chips"
```

---

## Task 16: Slide — Curva de ocupación y Matriz de complejidad

**Files:**
- Create: `apps/api/src/lib/pptx/slides/project-occupation-curve.ts`
- Create: `apps/api/src/lib/pptx/slides/project-complexity-matrix.ts`

- [ ] **Step 1: Implementar `project-occupation-curve.ts`**

```ts
// apps/api/src/lib/pptx/slides/project-occupation-curve.ts
import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildOccupationChart } from "../charts/occupation-chart.js";

export async function addProjectOccupationCurveSlide(pres: PptxGenJS, p: ProjectReportData): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  });
  s.addText(`Capacidad ocupada — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const png = await buildOccupationChart(p.occupationCurve, p.projectName);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });

  s.addText("El equipo se mantiene siempre productivo — reuniones, inducciones y fases del flujo QA cubren el 100% de la capacidad contratada.", {
    x: 0.5, y: 6.7, w: SLIDE.widthIn - 1, h: 0.5,
    fontFace: FONT.face, fontSize: 11, italic: true, color: PALETTE.textMuted, align: "center",
  });
}
```

- [ ] **Step 2: Implementar `project-complexity-matrix.ts`**

```ts
// apps/api/src/lib/pptx/slides/project-complexity-matrix.ts
import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildComplexityMatrix } from "../charts/complexity-matrix.js";

export async function addProjectComplexityMatrixSlide(pres: PptxGenJS, p: ProjectReportData): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  });
  s.addText(`Matriz de complejidad — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  if (p.complexityBubbles.length === 0) {
    s.addText("(Sin HUs con actividad para graficar)", {
      x: 0.5, y: 3, w: SLIDE.widthIn - 1, h: 1,
      fontFace: FONT.face, fontSize: 16, italic: true, color: PALETTE.textMuted, align: "center",
    });
    return;
  }

  const png = await buildComplexityMatrix(p.complexityBubbles);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 8, h: 5.6 });

  // Top 3 a la derecha.
  s.addText("Top esfuerzo acumulado", {
    x: 8.7, y: 1.1, w: 4.3, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const top3 = [...p.complexityBubbles].sort((a, b) => b.size - a.size).slice(0, 3);
  top3.forEach((b, i) => {
    const y = 1.7 + i * 1.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 8.7, y, w: 4.3, h: 1.4,
      fill: { color: PALETTE.white }, line: { color: PALETTE.blue, width: 1 }, rectRadius: 0.08,
    });
    s.addText(b.title, {
      x: 8.85, y: y + 0.1, w: 4.1, h: 0.7,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary,
    });
    s.addText(`Diseño ${b.designComplexity} · Ejec. ${b.executionComplexity} · ${b.size} casos`, {
      x: 8.85, y: y + 0.8, w: 4.1, h: 0.5,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textMuted,
    });
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/project-occupation-curve.ts src/lib/pptx/slides/project-complexity-matrix.ts`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/pptx/slides/project-occupation-curve.ts apps/api/src/lib/pptx/slides/project-complexity-matrix.ts
git commit -m "feat(api): add project occupation curve and complexity matrix slides"
```

---

## Task 17: Slide — Portfolio (pipeline, comparison, trend)

**Files:**
- Create: `apps/api/src/lib/pptx/slides/portfolio-pipeline.ts`
- Create: `apps/api/src/lib/pptx/slides/portfolio-comparison.ts`
- Create: `apps/api/src/lib/pptx/slides/portfolio-trend.ts`

- [ ] **Step 1: Implementar los tres slides**

```ts
// apps/api/src/lib/pptx/slides/portfolio-pipeline.ts
import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildPipelineDonut } from "../charts/portfolio-charts.js";

export async function addPortfolioPipelineSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: SLIDE.widthIn, h: 0.8, fill: { color: PALETTE.navyUi }, line: { type: "none" } });
  s.addText("Pipeline consolidado del portafolio", { x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white });
  const png = await buildPipelineDonut(spec.portfolio.pipeline);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
```

```ts
// apps/api/src/lib/pptx/slides/portfolio-comparison.ts
import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildComparisonBars } from "../charts/portfolio-charts.js";

export async function addPortfolioComparisonSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: SLIDE.widthIn, h: 0.8, fill: { color: PALETTE.navyUi }, line: { type: "none" } });
  s.addText("Diseñados vs Ejecutados por proyecto", { x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white });
  const png = await buildComparisonBars(spec.portfolio.comparison);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
```

```ts
// apps/api/src/lib/pptx/slides/portfolio-trend.ts
import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildTrendLine } from "../charts/portfolio-charts.js";

export async function addPortfolioTrendSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: SLIDE.widthIn, h: 0.8, fill: { color: PALETTE.navyUi }, line: { type: "none" } });
  const titleMap = { weekly: "Tendencia diaria del portafolio", monthly: "Tendencia semanal del portafolio", yearly: "Tendencia mensual del portafolio" } as const;
  s.addText(titleMap[spec.period], { x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white });
  const png = await buildTrendLine(spec.portfolio.trend);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/portfolio-pipeline.ts src/lib/pptx/slides/portfolio-comparison.ts src/lib/pptx/slides/portfolio-trend.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/slides/portfolio-pipeline.ts apps/api/src/lib/pptx/slides/portfolio-comparison.ts apps/api/src/lib/pptx/slides/portfolio-trend.ts
git commit -m "feat(api): add portfolio consolidation slides (pipeline, comparison, trend)"
```

---

## Task 18: Slide — Divisor del anexo + Detalle por analista

**Files:**
- Create: `apps/api/src/lib/pptx/slides/appendix-divider.ts`
- Create: `apps/api/src/lib/pptx/slides/analyst-detail.ts`

- [ ] **Step 1: Implementar `appendix-divider.ts`**

```ts
// apps/api/src/lib/pptx/slides/appendix-divider.ts
import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addAppendixDividerSlide(pres: PptxGenJS): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: SLIDE.heightIn / 2 - 0.1, w: SLIDE.widthIn, h: 0.05,
    fill: { color: PALETTE.greenPrimary }, line: { type: "none" },
  });
  s.addText("ANEXO", {
    x: 0, y: SLIDE.heightIn / 2 - 1.5, w: SLIDE.widthIn, h: 1,
    fontFace: FONT.face, fontSize: 64, bold: true, color: PALETTE.greenLight, align: "center",
  });
  s.addText("Detalle interno de operación", {
    x: 0, y: SLIDE.heightIn / 2 + 0.2, w: SLIDE.widthIn, h: 0.8,
    fontFace: FONT.face, fontSize: 24, color: PALETTE.grayLight, align: "center",
  });
}
```

- [ ] **Step 2: Implementar `analyst-detail.ts`**

```ts
// apps/api/src/lib/pptx/slides/analyst-detail.ts
import type PptxGenJS from "pptxgenjs";
import type { OccupationResult } from "../../occupation.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addAnalystDetailSlide(pres: PptxGenJS, a: OccupationResult): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  });
  s.addText(`Analista — ${a.testerName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  // KPI cards: capacidad, ocupación, horas actividad, sobre-asignación.
  const kpis: Array<{ v: string; l: string; c: string }> = [
    { v: `${a.capacityHours}h`, l: "Capacidad", c: PALETTE.blue },
    { v: `${a.activityHours}h`, l: "Horas de Activity", c: PALETTE.purple },
    { v: `${a.productiveHoursEstimate}h`, l: "Horas productivas estimadas", c: PALETTE.greenPrimary },
    { v: `${a.occupationPct}%`, l: "Ocupación", c: a.overallocated ? PALETTE.red : PALETTE.cyan },
  ];
  const cardW = 2.9;
  const startX = 0.5;
  kpis.forEach((kp, i) => {
    const x = startX + i * (cardW + 0.15);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.1, w: cardW, h: 1.3,
      fill: { color: PALETTE.white }, line: { color: kp.c, width: 2 }, rectRadius: 0.08,
    });
    s.addText(kp.v, {
      x, y: 1.2, w: cardW, h: 0.7,
      fontFace: FONT.face, fontSize: 28, bold: true, color: `#${kp.c}`, align: "center",
    });
    s.addText(kp.l, {
      x, y: 1.95, w: cardW, h: 0.35,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textMuted, align: "center",
    });
  });

  // Tabla de categorías.
  s.addText("Horas por categoría", {
    x: 0.5, y: 2.7, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const catRows: any[] = [[
    { text: "Categoría", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face, align: "right" } },
  ]];
  for (const c of a.byCategory) {
    catRows.push([
      { text: c.name, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: `${c.hours.toFixed(1)}h`, options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byCategory.length === 0) {
    catRows.push([{ text: "(Sin actividades registradas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(catRows, { x: 0.5, y: 3.2, w: 6, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } });

  // Tabla de assignments.
  s.addText("Horas por asignación", {
    x: 6.8, y: 2.7, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const asgRows: any[] = [[
    { text: "Historia de Usuario", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face, align: "right" } },
  ]];
  for (const g of a.byAssignment) {
    asgRows.push([
      { text: g.storyTitle, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: `${g.hours.toFixed(1)}h`, options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byAssignment.length === 0) {
    asgRows.push([{ text: "(Sin asignaciones con horas registradas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(asgRows, { x: 6.8, y: 3.2, w: 6, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } });

  if (a.overallocated) {
    s.addText("⚠ Analista sobre-asignado en el periodo", {
      x: 0.5, y: SLIDE.heightIn - 0.6, w: SLIDE.widthIn - 1, h: 0.4,
      fontFace: FONT.face, fontSize: 12, bold: true, color: PALETTE.red, align: "center",
    });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/slides/appendix-divider.ts src/lib/pptx/slides/analyst-detail.ts`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/pptx/slides/appendix-divider.ts apps/api/src/lib/pptx/slides/analyst-detail.ts
git commit -m "feat(api): add appendix divider and per-analyst occupation slide"
```

---

## Task 19: Orquestador `build-report-pptx.ts`

**Files:**
- Create: `apps/api/src/lib/pptx/build-report-pptx.ts`

- [ ] **Step 1: Implementar el orquestador**

```ts
// apps/api/src/lib/pptx/build-report-pptx.ts
import PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "./types.js";
import { SLIDE } from "./theme.js";
import { addCoverSlide } from "./slides/cover.js";
import { addExecutiveSummarySlide } from "./slides/executive-summary.js";
import { addProjectCoverSlide } from "./slides/project-cover.js";
import { addProjectHuTableSlide } from "./slides/project-hu-table.js";
import { addProjectOccupationCurveSlide } from "./slides/project-occupation-curve.js";
import { addProjectComplexityMatrixSlide } from "./slides/project-complexity-matrix.js";
import { addPortfolioPipelineSlide } from "./slides/portfolio-pipeline.js";
import { addPortfolioComparisonSlide } from "./slides/portfolio-comparison.js";
import { addPortfolioTrendSlide } from "./slides/portfolio-trend.js";
import { addAppendixDividerSlide } from "./slides/appendix-divider.js";
import { addAnalystDetailSlide } from "./slides/analyst-detail.js";
import { addClosingSlide } from "./slides/closing.js";

export async function buildReportPptx(spec: ReportSpec): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";     // 13.333 × 7.5 in
  pres.defineLayout({ name: "INOVABIZ_WIDE", width: SLIDE.widthIn, height: SLIDE.heightIn });
  pres.layout = "INOVABIZ_WIDE";
  pres.author = "Inovabiz";
  pres.company = "Inovabiz";
  pres.title = `Informe QA — ${spec.periodLabel}`;

  // Bloque A
  addCoverSlide(pres, spec);
  addExecutiveSummarySlide(pres, spec);

  // Bloque B — por proyecto
  for (const p of spec.projects) {
    addProjectCoverSlide(pres, p);
    addProjectHuTableSlide(pres, p);
    await addProjectOccupationCurveSlide(pres, p);
    await addProjectComplexityMatrixSlide(pres, p);
  }

  // Bloque C — portfolio
  if (spec.projects.length > 0) {
    await addPortfolioPipelineSlide(pres, spec);
    await addPortfolioComparisonSlide(pres, spec);
    await addPortfolioTrendSlide(pres, spec);
  }

  // Bloque D — anexo interno
  if (spec.includeInternalAppendix && spec.analysts.length > 0) {
    addAppendixDividerSlide(pres);
    for (const a of spec.analysts) {
      addAnalystDetailSlide(pres, a);
    }
  }

  addClosingSlide(pres);

  const nodeBuffer = await pres.write({ outputType: "nodebuffer" });
  return nodeBuffer as Buffer;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/lib/pptx/build-report-pptx.ts`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/pptx/build-report-pptx.ts
git commit -m "feat(api): orchestrate full PPTX report generation"
```

---

## Task 20: Cablear endpoint `/weekly-pptx` al nuevo pipeline

**Files:**
- Modify: `apps/api/src/routes/reports.routes.ts`

- [ ] **Step 1: Reemplazar el handler de `/weekly-pptx`**

Abrir `apps/api/src/routes/reports.routes.ts`. Localizar el bloque `router.get("/weekly-pptx", ...)` (línea aprox 370-590) y reemplazar por:

```ts
router.get(
  "/weekly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const weekStartParam = (req.query.weekStart as string | undefined)?.slice(0, 10);
      const clientIdFilter = req.query.clientId as string | undefined;
      const monday = weekStartParam ? new Date(`${weekStartParam}T00:00:00Z`) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const friday = addDays(monday, 4);
      const periodEnd = new Date(friday.getTime() + 24 * 3600 * 1000 - 1);

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientFilter = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "weekly",
        periodStart: monday,
        periodEnd,
        scope,
        clientFilter: clientFilter ? { id: clientFilter.id, name: clientFilter.name } : null,
        userRole: req.user!.role.name,
      });

      const buffer = await buildReportPptx(spec);
      const iso = monday.toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Semanal_${iso}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("weekly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX semanal" });
    }
  },
);
```

- [ ] **Step 2: Typecheck global del archivo**

Run: `cd apps/api && npx tsc --noEmit src/routes/reports.routes.ts`
Expected: sin errores (puede haber errores de imports ahora no usados; limpiarlos)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/reports.routes.ts
git commit -m "refactor(api): wire /weekly-pptx to the new Inovabiz PPTX pipeline"
```

---

## Task 21: Cablear `/monthly-pptx` y `/yearly-pptx`

**Files:**
- Modify: `apps/api/src/routes/reports.routes.ts`

- [ ] **Step 1: Reemplazar `/monthly-pptx`**

Localizar `router.get("/monthly-pptx", ...)` y reemplazar por:

```ts
router.get(
  "/monthly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const monthParam = (req.query.month as string | undefined) ?? format(new Date(), "yyyy-MM");
      const clientIdFilter = req.query.clientId as string | undefined;
      const monthDate = new Date(`${monthParam}-01T00:00:00Z`);
      const periodStart = startOfMonth(monthDate);
      const periodEnd = endOfMonth(monthDate);

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientFilter = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "monthly",
        periodStart,
        periodEnd,
        scope,
        clientFilter: clientFilter ? { id: clientFilter.id, name: clientFilter.name } : null,
        userRole: req.user!.role.name,
      });

      const buffer = await buildReportPptx(spec);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Mensual_${monthParam}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("monthly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX mensual" });
    }
  },
);
```

- [ ] **Step 2: Reemplazar `/yearly-pptx`**

Localizar `router.get("/yearly-pptx", ...)` y reemplazar por:

```ts
router.get(
  "/yearly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const year = Number(req.query.year) || new Date().getFullYear();
      const clientIdFilter = req.query.clientId as string | undefined;
      const periodStart = new Date(Date.UTC(year, 0, 1));
      const periodEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientFilter = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "yearly",
        periodStart,
        periodEnd,
        scope,
        clientFilter: clientFilter ? { id: clientFilter.id, name: clientFilter.name } : null,
        userRole: req.user!.role.name,
      });

      const buffer = await buildReportPptx(spec);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Anual_${year}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("yearly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX anual" });
    }
  },
);
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit src/routes/reports.routes.ts`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/reports.routes.ts
git commit -m "refactor(api): wire /monthly-pptx and /yearly-pptx to new pipeline"
```

---

## Task 22: Remover archivos obsoletos

**Files:**
- Delete: `apps/api/src/lib/weekly-pptx.ts`
- Delete: `apps/api/src/lib/weekly-charts.ts`
- Delete: `apps/api/src/assets/weekly-template.pptx`
- Modify: `apps/api/src/routes/reports.routes.ts` (quitar imports de `weekly-pptx.ts` y `weekly-charts.ts`)

- [ ] **Step 1: Borrar los imports obsoletos del archivo de rutas**

En `apps/api/src/routes/reports.routes.ts`, eliminar las líneas:

```ts
import { buildWeeklyPptxBuffer, type WeeklyProjectSlide } from "../lib/weekly-pptx.js";
import {
  buildPipelineDonut,
  buildDesignedVsExecutedBars,
  buildDefectsBars,
  buildMonthlyCumulativeBars,
  buildYearlyCumulativeBars,
  type PipelineDatum,
  type ProjectMetricsDatum,
  type WeekBucket,
  type MonthBucket,
} from "../lib/weekly-charts.js";
```

Y también `startOfMonth`, `endOfMonth`, `getISOWeek` si quedan sin uso (revisar con el linter; si siguen siendo usados por `/monthly-pptx` en el nuevo código, conservar).

- [ ] **Step 2: Borrar los archivos obsoletos**

```bash
rm apps/api/src/lib/weekly-pptx.ts
rm apps/api/src/lib/weekly-charts.ts
rm apps/api/src/assets/weekly-template.pptx
```

- [ ] **Step 3: Typecheck completo del API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/reports.routes.ts apps/api/src/lib/weekly-pptx.ts apps/api/src/lib/weekly-charts.ts apps/api/src/assets/weekly-template.pptx
git commit -m "chore(api): remove legacy PPTX template and XML-based builders"
```

---

## Task 23: Smoke test de integración del PPTX completo

**Files:**
- Create: `apps/api/src/__tests__/pptx-build-smoke.test.ts`

- [ ] **Step 1: Escribir el smoke test**

```ts
// apps/api/src/__tests__/pptx-build-smoke.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { API_URL, loginAs } from "./helpers/auth.js";
import JSZip from "jszip";

describe("PPTX endpoints — smoke test", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin@qametrics.com");
  });

  async function fetchPptx(endpoint: string) {
    const r = await fetch(`${API_URL}/api/reports/${endpoint}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(r.status).toBe(200);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  }

  async function assertIsValidPptx(buf: Buffer) {
    expect(buf.byteLength).toBeGreaterThan(20_000); // un PPTX razonable pesa >20KB
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("ppt/presentation.xml");
    // Al menos 3 slides (portada + 1 proyecto + cierre).
    const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides.length).toBeGreaterThanOrEqual(3);
  }

  it("weekly-pptx genera un PPTX válido", async () => {
    const buf = await fetchPptx("weekly-pptx?weekStart=2026-04-13");
    await assertIsValidPptx(buf);
  });

  it("monthly-pptx genera un PPTX válido", async () => {
    const buf = await fetchPptx("monthly-pptx?month=2026-04");
    await assertIsValidPptx(buf);
  });

  it("yearly-pptx genera un PPTX válido", async () => {
    const buf = await fetchPptx("yearly-pptx?year=2026");
    await assertIsValidPptx(buf);
  });
}, { timeout: 60_000 });
```

- [ ] **Step 2: Ejecutar el test (requiere API arriba)**

En una terminal levantar el API: `cd apps/api && npm run dev`

En otra: `cd apps/api && npx vitest run src/__tests__/pptx-build-smoke.test.ts`
Expected: PASS 3/3

- [ ] **Step 3: Si falla por timeout, diagnosticar**

Si algún test falla por timeout de 60s, investigar qué slide tarda (añadir `console.time` en `build-report-pptx.ts` alrededor de cada `add…Slide`). El criterio de spec §11.7 es `<15s` para weekly con 5 proyectos y 4 analistas; monthly/yearly pueden ser más lentos pero no deberían exceder 45s.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/pptx-build-smoke.test.ts
git commit -m "test(api): smoke-test all three PPTX endpoints produce valid zips"
```

---

## Self-Review

**1. Spec coverage check (spec §1-§11):**

- §1 Objetivo: 5 bullets cubiertos → pptxgenjs (T19), paleta Inovabiz (T2), ocupación detallada (T7-T9), curva siempre ocupados (T7 + T16), complejidad + regresión (T11 + T15 + spec types §3) → ✓
- §2 Audiencia: flag `includeInternalAppendix` derivado de `userRole` en T9; slide divisor T18 → ✓
- §3 Identidad visual: T2 (theme.ts), T1 (logo asset), T13 (cover usa el logo) → ✓
- §4 Estructura del deck: T13-T18 cubren los 12 tipos de slide → ✓
- §5 Datos y derivaciones: T4-T7 implementan las fórmulas §5.1, §5.2, §5.3, §5.4 → ✓
- §6 Arquitectura técnica: archivos listados coinciden con File Structure → ✓
- §7 Diferencias weekly/monthly/yearly: T20-T21 setean periodo + `bucketingFor()` en T9 → ✓
- §8 Seguridad: `includeInternalAppendix = userRole !== "CLIENT_PM"` en T9 → ✓
- §9 Invariantes: lectura Prisma únicamente, mismo scope que rutas existentes → ✓
- §10 Out of scope: no se crean campos nuevos en Prisma, no hay email ni UI web → ✓
- §11 Aceptación: smoke test T23 cubre #1 y #8; #7 (bajo 15s weekly) necesita medición manual post-implementación → anotado

**2. Placeholder scan:** ninguna aparición de "TBD", "TODO", "implement later", "fill in details". Todas las funciones referenciadas tienen tarea que las define.

**3. Type consistency:** `OccupationBand["label"]` en types.ts matches `BAND_ORDER` en occupation-math.ts. `PhaseRef` y `PhaseSegment` distintos (uno transitorio, otro para input externo). `ReportSpec` exporta `PortfolioTrendPoint` usada en T12. `ComplexityLevel` consistente en types.ts y slides. `OccupationResult` importado de `occupation.js` (fuente única). ✓

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-04-22-reporte-pptx-profesional.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — despacho un subagente fresco por tarea con revisión entre tareas, iteración rápida, contexto aislado.

**2. Inline Execution** — ejecuto las tareas en esta misma sesión con checkpoints de revisión al cierre de cada tarea.

¿Cuál prefieres?
