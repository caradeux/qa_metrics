// Helpers para formatear fechas que representan un "día" (no un instante).
//
// El backend guarda fechas tipo día (TestCycle.startDate, TesterAssignment.endDate,
// AssignmentPhase, DailyRecord.date, Holiday.date, DateChangeLog.oldValue/newValue,
// etc.) como UTC midnight (ej: "2026-05-15T00:00:00.000Z"). Si se usa
// `new Date(iso).toLocaleDateString("es")` en una zona horaria oeste de UTC
// (Chile: UTC-3 o UTC-4) el formateador resta horas y muestra el día anterior.
//
// Estos helpers fuerzan el formateo en UTC para que el "día" se mantenga.
// Para timestamps reales (createdAt, updatedAt, changedAt) NO uses esto; eso
// es un evento con hora y debe mostrarse en zona horaria local del usuario.

function parseToDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

/** Devuelve "DD/MM/YYYY" en UTC. */
export function fmtDateUtc(value: Date | string | null | undefined): string {
  const d = parseToDate(value);
  if (!d) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** Devuelve "DD MMM" (ej: "15 may") en UTC. */
export function fmtDateShortUtc(value: Date | string | null | undefined): string {
  const d = parseToDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** Devuelve "DD MMM YYYY" (ej: "15 may 2026") en UTC. */
export function fmtDateLongUtc(value: Date | string | null | undefined): string {
  const d = parseToDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
