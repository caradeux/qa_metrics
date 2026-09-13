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

/**
 * Normalises a Date to local midnight for the same calendar day as its UTC
 * year/month/day components.  This prevents ISO-date strings parsed as UTC
 * midnight (e.g. new Date("2026-04-06")) from shifting to the previous day in
 * negative-offset timezones before startOfWeek is applied.
 */
function toLocalCalendarDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function aggregateAutomationDailyToWeekly(
  records: AutomationDailyLike[]
): AutomationWeekBucket[] {
  const buckets = new Map<string, AutomationWeekBucket>();
  for (const r of records) {
    const ws = startOfWeek(toLocalCalendarDate(r.date), { weekStartsOn: 1 });
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

export type AutomationMetric = Exclude<keyof AutomationDailyLike, "date">;

const AUTOMATION_METRICS: AutomationMetric[] = [
  "scriptsCreated",
  "scriptsRefactored",
  "scriptsFixed",
  "execTotal",
  "execPassed",
  "execFailed",
];

export interface AutomationPeriodReport {
  totals: Record<AutomationMetric, number[]>;
  passRatePct: number[];
  scriptsByProject: { project: string; values: number[] }[];
  execByProject: { project: string; values: number[] }[];
}

/**
 * Agrega registros de automatizacion en los periodos (meses o semanas) de un
 * reporte. `periodKeyFor` recibe la fecha ya normalizada al dia calendario
 * (las columnas @db.Date llegan como medianoche UTC) y devuelve la clave del
 * periodo; los registros cuya clave no esta en `periodKeys` se ignoran.
 */
export function aggregateAutomationByPeriod(
  records: (AutomationDailyLike & { projectId: string })[],
  periodKeys: string[],
  projects: { id: string; name: string }[],
  periodKeyFor: (calendarDate: Date) => string
): AutomationPeriodReport {
  const index = new Map(periodKeys.map((k, i) => [k, i]));
  const zeros = () => periodKeys.map(() => 0);
  const totals = Object.fromEntries(AUTOMATION_METRICS.map((m) => [m, zeros()])) as Record<AutomationMetric, number[]>;
  const scripts = new Map(projects.map((p) => [p.id, zeros()]));
  const exec = new Map(projects.map((p) => [p.id, zeros()]));

  for (const r of records) {
    const i = index.get(periodKeyFor(toLocalCalendarDate(r.date)));
    if (i === undefined) continue;
    for (const m of AUTOMATION_METRICS) totals[m][i] += r[m];
    const s = scripts.get(r.projectId);
    if (s) s[i] += r.scriptsCreated + r.scriptsRefactored + r.scriptsFixed;
    const e = exec.get(r.projectId);
    if (e) e[i] += r.execTotal;
  }

  return {
    totals,
    passRatePct: periodKeys.map((_, i) =>
      Math.round(passRate({ execTotal: totals.execTotal[i], execPassed: totals.execPassed[i] }) * 100)
    ),
    scriptsByProject: projects.map((p) => ({ project: p.name, values: scripts.get(p.id)! })),
    execByProject: projects.map((p) => ({ project: p.name, values: exec.get(p.id)! })),
  };
}
