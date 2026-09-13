import { ACTIVE_STATUSES } from "./assignment-states.js";

/**
 * Días que una HU sigue visible en "Mi semana" después de cerrarse (Producción)
 * o de quedar Detenida, para poder cargar lo trabajado antes del cambio de
 * estado (p. ej. diseños del mismo día en que se detuvo) y bugs tardíos.
 */
export const CATCH_UP_DAYS = 7;
const DAY_MS = 86_400_000;

/** Estados que siempre se muestran: en curso, y los que siguen generando carga QA. */
const ALWAYS_VISIBLE = new Set<string>([...ACTIVE_STATUSES, "RETURNED_TO_DEV", "UAT"]);

export interface WeeklyGridAssignment {
  status: string;
  hasRecordsInWeek: boolean;
  lastProductionAt: Date | null;
  lastOnHoldAt: Date | null;
}

export function isVisibleInWeeklyGrid(
  a: WeeklyGridAssignment,
  opts: { isAnalyst: boolean; todayMs: number },
): boolean {
  // Con registros en la semana siempre se muestra, para poder editarlos.
  if (a.hasRecordsInWeek) return true;
  if (ALWAYS_VISIBLE.has(a.status)) return true;
  const windowStart = opts.todayMs - CATCH_UP_DAYS * DAY_MS;
  if (a.status === "PRODUCTION") {
    return opts.isAnalyst && !!a.lastProductionAt && a.lastProductionAt.getTime() >= windowStart;
  }
  if (a.status === "ON_HOLD") {
    return !!a.lastOnHoldAt && a.lastOnHoldAt.getTime() >= windowStart;
  }
  return false;
}
