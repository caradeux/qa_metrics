export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function isMonday(date: Date): boolean {
  return date.getUTCDay() === 1;
}

export function getWeekLabel(monday: Date): string {
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const startStr = monday.toLocaleDateString("es", opts);
  const endStr = end.toLocaleDateString("es", opts);
  const weekNum = getISOWeekNumber(monday);
  return `Sem. ${weekNum} (${startStr} - ${endStr})`;
}

export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  let current = getMonday(start);
  const endMonday = getMonday(end);
  while (current <= endMonday) {
    weeks.push(new Date(current));
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return weeks;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}
