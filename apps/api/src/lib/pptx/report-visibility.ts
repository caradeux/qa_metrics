// Estados "en progreso": si el ÚLTIMO ciclo de una HU está en alguno, la HU se
// muestra. PRODUCTION no está: una HU en producción solo aparece la semana en que
// pasó a producción o si tuvo actividad esa semana.
export const VISIBLE_STATUSES = [
  "REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY",
  "EXECUTION", "RETURNED_TO_DEV", "UAT", "ON_HOLD",
] as const;

export interface VisibilityAssignment {
  status: string;
  createdAt: Date;
  dailyRecords: ReadonlyArray<unknown>;           // registros DENTRO del periodo
  productionLogsInPeriod: ReadonlyArray<unknown>; // logs de paso a PRODUCTION DENTRO del periodo
}

export function isStoryVisibleInPeriod(assignments: ReadonlyArray<VisibilityAssignment>): boolean {
  if (assignments.length === 0) return false;
  const latest = assignments.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  const latestOngoing = (VISIBLE_STATUSES as readonly string[]).includes(latest.status);
  const hadActivity = assignments.some((a) => a.dailyRecords.length > 0);
  const wentToProd = assignments.some((a) => a.productionLogsInPeriod.length > 0);
  return latestOngoing || hadActivity || wentToProd;
}
