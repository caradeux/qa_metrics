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
