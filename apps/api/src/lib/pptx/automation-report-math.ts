import { getISOWeek } from "date-fns";
import type {
  AutomationLineRow,
  AutomationProjectReportData,
  AutomationTotals,
  AutomationTrendPoint,
  ReportPeriod,
} from "./types.js";

// Lógica pura (sin Prisma) del bloque de automatización del PPTX, para poder
// testearla sin base de datos. Las fechas de AutomationRecord son @db.Date y
// llegan como medianoche UTC: todo el bucketing usa componentes UTC.

const DAY_MS = 86_400_000;
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  MAINTENANCE: "Mantenimiento",
  PAUSED: "Pausada",
  DONE: "Finalizada",
};

export const emptyTotals = (): AutomationTotals => ({
  scriptsCreated: 0,
  scriptsRefactored: 0,
  scriptsFixed: 0,
  execTotal: 0,
  execPassed: 0,
  execFailed: 0,
});

function addTotals(acc: AutomationTotals, r: AutomationTotals): void {
  acc.scriptsCreated += r.scriptsCreated;
  acc.scriptsRefactored += r.scriptsRefactored;
  acc.scriptsFixed += r.scriptsFixed;
  acc.execTotal += r.execTotal;
  acc.execPassed += r.execPassed;
  acc.execFailed += r.execFailed;
}

export function passRatePct(t: { execTotal: number; execPassed: number }): number {
  return t.execTotal > 0 ? Math.round((t.execPassed / t.execTotal) * 100) : 0;
}

export function scriptsWorked(t: AutomationTotals): number {
  return t.scriptsCreated + t.scriptsRefactored + t.scriptsFixed;
}

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

function mondayOf(dayMs: number): number {
  const dow = new Date(dayMs).getUTCDay() || 7;
  return dayMs - (dow - 1) * DAY_MS;
}

/**
 * Buckets del gráfico de tendencia, alineados con el resto del deck:
 * semanal → días hábiles, mensual → semanas ISO, anual → meses. Se generan
 * todos (aunque no tengan registros) para que el eje muestre el periodo completo.
 */
export function automationBuckets(
  period: ReportPeriod,
  periodStart: Date,
  periodEnd: Date,
): { keyFor: (date: Date) => string; buckets: Array<{ key: string; label: string }> } {
  const start = utcDay(periodStart);
  const end = utcDay(periodEnd);
  const buckets: Array<{ key: string; label: string }> = [];

  if (period === "weekly") {
    for (let d = start; d <= end; d += DAY_MS) {
      const date = new Date(d);
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      buckets.push({ key: String(d), label: `${DOW[dow]} ${date.getUTCDate()}` });
    }
    return { keyFor: (date) => String(utcDay(date)), buckets };
  }

  if (period === "monthly") {
    for (let w = mondayOf(start); w <= end; w += 7 * DAY_MS) {
      buckets.push({ key: String(w), label: `Sem ${getISOWeek(new Date(w + 3 * DAY_MS))}` });
    }
    return { keyFor: (date) => String(mondayOf(utcDay(date))), buckets };
  }

  const first = new Date(start);
  for (let m = first.getUTCMonth(), y = first.getUTCFullYear(); Date.UTC(y, m, 1) <= end; m++) {
    const at = new Date(Date.UTC(y, m, 1));
    buckets.push({ key: `${at.getUTCFullYear()}-${at.getUTCMonth()}`, label: MONTHS[at.getUTCMonth()]! });
  }
  return { keyFor: (date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}`, buckets };
}

export interface AutomationRecordInput extends AutomationTotals {
  date: Date;
  notes: string | null;
  testLineId: string;
}

export interface AutomationLineInput {
  id: string;
  name: string;
  assignments: Array<{ status: string; testerName: string; createdAt: Date }>;
}

export interface AutomationProjectInput {
  id: string;
  name: string;
  clientName: string;
  projectManagerName: string | null;
  testers: Array<{ id: string; name: string; allocation: number }>;
  lines: AutomationLineInput[];
}

/** Estado de la línea: el de su asignación abierta más reciente (o la más reciente a secas). */
function lineStatus(assignments: AutomationLineInput["assignments"]): string {
  if (assignments.length === 0) return "Sin asignar";
  const byRecent = [...assignments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const open = byRecent.find((a) => a.status === "ACTIVE" || a.status === "MAINTENANCE");
  const status = (open ?? byRecent[0]!).status;
  return STATUS_LABEL[status] ?? status;
}

/**
 * Arma los datos de un proyecto de automatización para el periodo. Muestra las
 * líneas con registros en el periodo y las que siguen abiertas (activas o en
 * mantenimiento) aunque no hayan tenido actividad.
 */
export function summarizeAutomationProject(
  project: AutomationProjectInput,
  records: AutomationRecordInput[],
  period: ReportPeriod,
  periodStart: Date,
  periodEnd: Date,
): AutomationProjectReportData {
  const kpis = emptyTotals();
  const byLine = new Map<string, { totals: AutomationTotals; lastNote: { date: number; text: string } | null }>();
  const { keyFor, buckets } = automationBuckets(period, periodStart, periodEnd);
  const trendByKey = new Map<string, AutomationTotals>(buckets.map((b) => [b.key, emptyTotals()]));

  for (const r of records) {
    addTotals(kpis, r);
    const line = byLine.get(r.testLineId) ?? { totals: emptyTotals(), lastNote: null };
    addTotals(line.totals, r);
    const note = r.notes?.trim();
    if (note && (!line.lastNote || r.date.getTime() >= line.lastNote.date)) {
      line.lastNote = { date: r.date.getTime(), text: note };
    }
    byLine.set(r.testLineId, line);
    const bucket = trendByKey.get(keyFor(r.date));
    if (bucket) addTotals(bucket, r);
  }

  const lines: AutomationLineRow[] = project.lines
    .filter((l) => byLine.has(l.id) || l.assignments.some((a) => a.status === "ACTIVE" || a.status === "MAINTENANCE"))
    .map((l) => {
      const agg = byLine.get(l.id);
      const totals = agg?.totals ?? emptyTotals();
      return {
        testLineId: l.id,
        name: l.name,
        responsibles: [...new Set(l.assignments.map((a) => a.testerName))],
        statusLabel: lineStatus(l.assignments),
        ...totals,
        passRatePct: passRatePct(totals),
        lastNote: agg?.lastNote?.text ?? null,
      };
    })
    .sort((a, b) => scriptsWorked(b) + b.execTotal - (scriptsWorked(a) + a.execTotal) || a.name.localeCompare(b.name));

  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.clientName,
    projectManagerName: project.projectManagerName,
    testers: project.testers,
    kpis: { ...kpis, passRatePct: passRatePct(kpis) },
    lines,
    trend: buckets.map((b) => ({ label: b.label, ...trendByKey.get(b.key)! })),
  };
}

/** Totales consolidados de todos los proyectos de automatización del reporte. */
export function automationPortfolioTotals(projects: AutomationProjectReportData[]) {
  const totals = emptyTotals();
  for (const p of projects) addTotals(totals, p.kpis);
  return {
    ...totals,
    passRatePct: passRatePct(totals),
    totalLines: projects.reduce((s, p) => s + p.lines.length, 0),
  };
}
