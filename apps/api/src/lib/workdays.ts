import { prisma } from "@qa-metrics/database";

/**
 * Normaliza un Date o string `YYYY-MM-DD` a un Date en UTC con hora 00:00:00.
 * Así todas las comparaciones (día de semana, lookup de feriados) usan la misma zona.
 */
function toUtcDateOnly(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  // string YYYY-MM-DD
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/**
 * Returns true when `date` is a weekday (Mon-Fri) and NOT a registered holiday.
 * Evaluado en UTC para evitar desplazamientos por zona horaria local.
 */
export async function isWorkday(date: Date | string): Promise<boolean> {
  const utc = toUtcDateOnly(date);
  const dow = utc.getUTCDay(); // 0=Dom, 6=Sáb
  if (dow === 0 || dow === 6) return false;
  const h = await prisma.holiday.findUnique({ where: { date: utc } });
  return !h;
}

/**
 * Lista de días hábiles (lunes-viernes, excluyendo feriados) entre `from` y `to` inclusivos.
 * Ambos valores se normalizan a UTC 00:00.
 */
export async function workdaysInRange(
  from: Date | string,
  to: Date | string
): Promise<Date[]> {
  const start = toUtcDateOnly(from);
  const end = toUtcDateOnly(to);
  if (start.getTime() > end.getTime()) return [];

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.getTime()));

  const result: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend && !holidaySet.has(cursor.getTime())) {
      result.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
