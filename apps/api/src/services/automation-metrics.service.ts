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
