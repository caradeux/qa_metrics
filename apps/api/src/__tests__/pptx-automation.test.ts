import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  automationBuckets,
  summarizeAutomationProject,
  type AutomationProjectInput,
  type AutomationRecordInput,
} from "../lib/pptx/automation-report-math.js";
import { buildReportPptx, reportDeckKind } from "../lib/pptx/build-report-pptx.js";
import type { ReportSpec } from "../lib/pptx/types.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rec = (date: string, testLineId: string, over: Partial<AutomationRecordInput> = {}): AutomationRecordInput => ({
  date: d(date),
  testLineId,
  notes: null,
  scriptsCreated: 0,
  scriptsRefactored: 0,
  scriptsFixed: 0,
  execTotal: 0,
  execPassed: 0,
  execFailed: 0,
  ...over,
});

const project: AutomationProjectInput = {
  id: "p1",
  name: "Automatizacion",
  clientName: "Autofin",
  projectManagerName: null,
  testers: [{ id: "t1", name: "Jeremy Henriquez", allocation: 50 }],
  lines: [
    { id: "cob", name: "CRM Cobranzas", assignments: [{ status: "ACTIVE", testerName: "Jeremy Henriquez", createdAt: d("2026-06-16") }] },
    { id: "dec", name: "CRM DEC", assignments: [{ status: "ACTIVE", testerName: "Jeremy Henriquez", createdAt: d("2026-09-13") }] },
    { id: "old", name: "Correccion Trinidad", assignments: [{ status: "DONE", testerName: "Jeremy Henriquez", createdAt: d("2026-06-03") }] },
  ],
};

const septemberRecords = [
  rec("2026-09-01", "dec", { scriptsCreated: 17 }),
  rec("2026-09-02", "dec", { scriptsCreated: 17 }),
  rec("2026-09-03", "dec", { scriptsCreated: 17 }),
  rec("2026-09-04", "dec", { scriptsCreated: 16, execTotal: 67, execPassed: 67, notes: "build #14 OK" }),
  rec("2026-09-08", "cob", { scriptsRefactored: 40, notes: "refactor" }),
  rec("2026-09-09", "cob", { scriptsRefactored: 40, notes: "refactor" }),
  rec("2026-09-10", "cob", { scriptsRefactored: 39, execTotal: 119, execPassed: 106, execFailed: 13, notes: "Jenkins #11" }),
];

describe("automationBuckets", () => {
  it("semanal: solo días hábiles con etiqueta de día", () => {
    const { buckets, keyFor } = automationBuckets("weekly", d("2026-09-07"), new Date("2026-09-11T23:59:59.999Z"));
    expect(buckets.map((b) => b.label)).toEqual(["Lun 7", "Mar 8", "Mié 9", "Jue 10", "Vie 11"]);
    expect(keyFor(d("2026-09-10"))).toBe(buckets[3]!.key);
  });

  it("mensual: semanas ISO que tocan el mes", () => {
    const { buckets, keyFor } = automationBuckets("monthly", d("2026-09-01"), new Date("2026-09-30T23:59:59Z"));
    expect(buckets.map((b) => b.label)).toEqual(["Sem 36", "Sem 37", "Sem 38", "Sem 39", "Sem 40"]);
    expect(keyFor(d("2026-09-04"))).toBe(buckets[0]!.key);
    expect(keyFor(d("2026-09-08"))).toBe(buckets[1]!.key);
  });

  it("anual: 12 meses", () => {
    const { buckets } = automationBuckets("yearly", d("2026-01-01"), new Date("2026-12-31T23:59:59Z"));
    expect(buckets).toHaveLength(12);
    expect(buckets[8]!.label).toBe("sep");
  });
});

describe("summarizeAutomationProject", () => {
  const monthStart = d("2026-09-01");
  const monthEnd = new Date("2026-09-30T23:59:59Z");

  it("totaliza el proyecto, calcula la tasa de éxito y reparte por semana", () => {
    const r = summarizeAutomationProject(project, septemberRecords, "monthly", monthStart, monthEnd);
    expect(r.kpis).toMatchObject({
      scriptsCreated: 67,
      scriptsRefactored: 119,
      scriptsFixed: 0,
      execTotal: 186,
      execPassed: 173,
      execFailed: 13,
      passRatePct: 93,
    });
    expect(r.trend.map((t) => t.scriptsCreated + t.scriptsRefactored)).toEqual([67, 119, 0, 0, 0]);
    expect(r.trend.map((t) => t.execTotal)).toEqual([67, 119, 0, 0, 0]);
  });

  it("detalla líneas con actividad o abiertas, ordenadas por volumen, con la última nota", () => {
    const r = summarizeAutomationProject(project, septemberRecords, "monthly", monthStart, monthEnd);
    expect(r.lines.map((l) => l.name)).toEqual(["CRM Cobranzas", "CRM DEC"]);
    const cob = r.lines[0]!;
    expect(cob).toMatchObject({ scriptsRefactored: 119, execFailed: 13, passRatePct: 89, statusLabel: "Activa", lastNote: "Jenkins #11" });
    expect(cob.responsibles).toEqual(["Jeremy Henriquez"]);
  });

  it("línea abierta sin registros aparece en cero; la finalizada sin registros no", () => {
    const r = summarizeAutomationProject(project, [], "weekly", d("2026-09-14"), new Date("2026-09-18T23:59:59Z"));
    expect(r.lines.map((l) => l.name)).toEqual(["CRM Cobranzas", "CRM DEC"]);
    expect(r.kpis.passRatePct).toBe(0);
    expect(r.trend).toHaveLength(5);
  });
});

function specWith(overrides: Partial<ReportSpec>): ReportSpec {
  const emptyCurve = { buckets: [], bands: [] };
  return {
    period: "monthly",
    periodStart: d("2026-09-01"),
    periodEnd: new Date("2026-09-30T23:59:59Z"),
    periodLabel: "septiembre 2026",
    clientFilter: { id: "c1", name: "Autofin" },
    projects: [],
    automationProjects: [],
    analysts: [],
    analystCurves: [],
    teamCurve: emptyCurve,
    portfolio: {
      kpis: {
        designed: 0, executed: 0, defects: 0, ratioPct: 0, advancePct: 0,
        husFirstCycle: 0, husMultipleCycles: 0, capacityUtilizationPct: 0,
        totalProjects: 0, totalAnalysts: 1,
      },
      pipeline: [],
      comparison: [],
      trend: [],
    },
    includeInternalAppendix: true,
    ...overrides,
  };
}

async function slideTexts(buf: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return Promise.all(names.map(async (n) => (await zip.file(n)!.async("string")).replace(/<[^>]+>/g, " ")));
}

describe("buildReportPptx — automatización", () => {
  it("reportDeckKind distingue manual, automatización y mixto", () => {
    const auto = summarizeAutomationProject(project, septemberRecords, "monthly", d("2026-09-01"), d("2026-09-30"));
    expect(reportDeckKind({ projects: [], automationProjects: [] })).toBe("manual");
    expect(reportDeckKind({ projects: [], automationProjects: [auto] })).toBe("automation");
    expect(reportDeckKind({ projects: [{} as any], automationProjects: [auto] })).toBe("mixed");
  });

  it(
    "solo automatización genera un deck propio sin slides de HUs ni capacidad",
    async () => {
      const auto = summarizeAutomationProject(project, septemberRecords, "monthly", d("2026-09-01"), new Date("2026-09-30T23:59:59Z"));
      const texts = await slideTexts(await buildReportPptx(specWith({ automationProjects: [auto] })));
      const all = texts.join("\n");

      // Portada, resumen, ficha, detalle de líneas, tendencia y cierre.
      expect(texts).toHaveLength(6);
      expect(texts[0]).toContain("Informe de Automatización QA");
      expect(all).toContain("Resumen de automatización");
      expect(all).toContain("Detalle por línea de prueba — Automatizacion");
      expect(all).toContain("CRM Cobranzas");
      expect(all).toContain("Jenkins #11");
      expect(all).toContain("93%");
      expect(all).not.toContain("Historia de Usuario");
      expect(all).not.toContain("Estados del flujo QA");
      expect(all).not.toContain("Casos Diseñados");
    },
    60_000,
  );
});
