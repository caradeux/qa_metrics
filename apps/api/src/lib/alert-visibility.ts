// Una HU se considera "cerrada" para efectos de las alertas si su ÚLTIMO ciclo
// (el assignment más reciente por createdAt) está en un estado excluido
// (PRODUCTION / UAT / ON_HOLD). Esto evita seguir alertando ciclos viejos
// (p.ej. RETURNED_TO_DEV) de una HU cuyo ciclo mayor ya pasó a producción.
export function isLatestCycleExcluded(
  assignments: ReadonlyArray<{ status: string; createdAt: Date }>,
  excludedStatuses: ReadonlyArray<string>,
): boolean {
  if (assignments.length === 0) return false;
  const latest = assignments.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  return excludedStatuses.includes(latest.status);
}
