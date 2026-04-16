// Tipo laxo que admite tanto el cliente global como el tx de transacción.
// Prisma valida en runtime la forma real de los datos.
type PrismaLike = { dateChangeLog: { createMany: (args: any) => Promise<any> } };

export const MIN_REASON_LENGTH = 10;

export type DateChangeEntityType = "CYCLE" | "ASSIGNMENT" | "PHASE";

export interface DateDiff {
  field: "startDate" | "endDate";
  oldValue: Date | null;
  newValue: Date | null;
}

/**
 * Compara dos valores de fecha (admite null) y devuelve true si son distintos.
 * Normaliza comparando timestamps para evitar falsos positivos por referencia.
 */
export function dateChanged(oldVal: Date | null | undefined, newVal: Date | null | undefined): boolean {
  const o = oldVal ? new Date(oldVal).getTime() : null;
  const n = newVal ? new Date(newVal).getTime() : null;
  return o !== n;
}

/**
 * Valida que si hubo cambio de fechas, se haya enviado un `reason` con mínimo
 * MIN_REASON_LENGTH caracteres. Devuelve mensaje de error o null si está ok.
 */
export function validateReasonForChanges(
  reason: string | undefined | null,
  diffs: DateDiff[],
): string | null {
  if (diffs.length === 0) return null;
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return `Debes indicar un motivo de al menos ${MIN_REASON_LENGTH} caracteres para modificar fechas`;
  }
  return null;
}

/**
 * Inserta los DateChangeLog correspondientes dentro de una transacción o
 * usando el cliente global. Acepta múltiples diffs del mismo entity.
 */
export async function writeDateChangeLogs(
  client: PrismaLike,
  params: {
    entityType: DateChangeEntityType;
    entityId: string;
    userId: string;
    reason: string;
    diffs: DateDiff[];
  },
): Promise<void> {
  if (params.diffs.length === 0) return;
  const trimmed = params.reason.trim();
  await client.dateChangeLog.createMany({
    data: params.diffs.map((d) => ({
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      field: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      reason: trimmed,
    })),
  });
}
