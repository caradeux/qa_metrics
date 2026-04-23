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
