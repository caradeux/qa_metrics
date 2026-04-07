interface Record {
  weekStart: Date | string;
  designedTotal: number;
  designedFunctional: number;
  designedRegression: number;
  designedSmoke: number;
  designedExploratory: number;
  executedTotal: number;
  executedFunctional: number;
  executedRegression: number;
  executedSmoke: number;
  executedExploratory: number;
  defectsCritical: number;
  defectsHigh: number;
  defectsMedium: number;
  defectsLow: number;
  testerId: string;
  tester?: { name: string };
}

export interface KPIs {
  totalDesigned: number;
  totalExecuted: number;
  totalDefects: number;
  executionRatio: number;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  designed: number;
  executed: number;
  defects: number;
}

export interface CaseTypeDistribution {
  functional: { designed: number; executed: number };
  regression: { designed: number; executed: number };
  smoke: { designed: number; executed: number };
  exploratory: { designed: number; executed: number };
}

export interface DefectDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TesterSummary {
  testerId: string;
  testerName: string;
  designed: number;
  executed: number;
  defects: number;
  ratio: number;
}

export function calculateKPIs(records: Record[]): KPIs {
  const totalDesigned = records.reduce((sum, r) => sum + r.designedTotal, 0);
  const totalExecuted = records.reduce((sum, r) => sum + r.executedTotal, 0);
  const totalDefects = records.reduce(
    (sum, r) => sum + r.defectsCritical + r.defectsHigh + r.defectsMedium + r.defectsLow, 0
  );
  const executionRatio = totalDesigned > 0 ? Math.round((totalExecuted / totalDesigned) * 100) : 0;

  return { totalDesigned, totalExecuted, totalDefects, executionRatio };
}

export function aggregateWeeklyTrend(records: Record[]): WeeklyTrendPoint[] {
  const grouped = new Map<string, { designed: number; executed: number; defects: number }>();

  for (const r of records) {
    const key = new Date(r.weekStart).toISOString().split("T")[0];
    const existing = grouped.get(key) || { designed: 0, executed: 0, defects: 0 };
    existing.designed += r.designedTotal;
    existing.executed += r.executedTotal;
    existing.defects += r.defectsCritical + r.defectsHigh + r.defectsMedium + r.defectsLow;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, data]) => ({ weekStart, ...data }));
}

export function aggregateCaseTypes(records: Record[]): CaseTypeDistribution {
  const result: CaseTypeDistribution = {
    functional: { designed: 0, executed: 0 },
    regression: { designed: 0, executed: 0 },
    smoke: { designed: 0, executed: 0 },
    exploratory: { designed: 0, executed: 0 },
  };

  for (const r of records) {
    result.functional.designed += r.designedFunctional;
    result.functional.executed += r.executedFunctional;
    result.regression.designed += r.designedRegression;
    result.regression.executed += r.executedRegression;
    result.smoke.designed += r.designedSmoke;
    result.smoke.executed += r.executedSmoke;
    result.exploratory.designed += r.designedExploratory;
    result.exploratory.executed += r.executedExploratory;
  }

  return result;
}

export function aggregateDefects(records: Record[]): DefectDistribution {
  return records.reduce(
    (acc, r) => ({
      critical: acc.critical + r.defectsCritical,
      high: acc.high + r.defectsHigh,
      medium: acc.medium + r.defectsMedium,
      low: acc.low + r.defectsLow,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

export function aggregateTesterSummary(records: Record[]): TesterSummary[] {
  const grouped = new Map<string, TesterSummary>();

  for (const r of records) {
    const existing = grouped.get(r.testerId) || {
      testerId: r.testerId,
      testerName: r.tester?.name || "Unknown",
      designed: 0, executed: 0, defects: 0, ratio: 0,
    };
    existing.designed += r.designedTotal;
    existing.executed += r.executedTotal;
    existing.defects += r.defectsCritical + r.defectsHigh + r.defectsMedium + r.defectsLow;
    grouped.set(r.testerId, existing);
  }

  return Array.from(grouped.values()).map(t => ({
    ...t,
    ratio: t.designed > 0 ? Math.round((t.executed / t.designed) * 100) : 0,
  }));
}
