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
