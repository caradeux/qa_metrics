import { startOfWeek } from "date-fns";

export interface DailyLike {
  date: Date;
  designed: number;
  executed: number;
  defects: number;
}

export interface WeekBucket {
  weekStart: Date;
  designed: number;
  executed: number;
  defects: number;
}

export function aggregateDailyToWeekly(records: DailyLike[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();
  for (const r of records) {
    const ws = startOfWeek(r.date, { weekStartsOn: 1 });
    const key = ws.toISOString();
    const cur =
      buckets.get(key) ?? { weekStart: ws, designed: 0, executed: 0, defects: 0 };
    cur.designed += r.designed;
    cur.executed += r.executed;
    cur.defects += r.defects;
    buckets.set(key, cur);
  }
  return [...buckets.values()].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
  );
}
