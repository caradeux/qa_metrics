export function previousWorkday(from: Date, holidays: Date[]): Date {
  const holidayKeys = new Set(holidays.map((d) => d.toISOString().slice(0, 10)));
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - 1);
  while (true) {
    const day = d.getUTCDay();
    const key = d.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidayKeys.has(key)) return d;
    d.setUTCDate(d.getUTCDate() - 1);
  }
}

export function isWorkday(date: Date, holidays: Date[]): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const key = date.toISOString().slice(0, 10);
  return !holidays.some((h) => h.toISOString().slice(0, 10) === key);
}
