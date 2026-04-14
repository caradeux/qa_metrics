import { prisma } from "@qa-metrics/database";

function toDateOnly(date: Date): Date {
  const iso = date.toISOString().slice(0, 10);
  return new Date(iso + "T00:00:00.000Z");
}

/**
 * Returns true when `date` is a weekday (Mon-Fri) and NOT a registered holiday.
 */
export async function isWorkday(date: Date): Promise<boolean> {
  const dow = date.getUTCDay(); // 0=Sun, 6=Sat — stored in UTC date-only
  const localDow = date.getDay();
  // consider both interpretations for safety: reject if either is weekend
  if (dow === 0 || dow === 6 || localDow === 0 || localDow === 6) return false;
  const h = await prisma.holiday.findUnique({ where: { date: toDateOnly(date) } });
  return !h;
}
