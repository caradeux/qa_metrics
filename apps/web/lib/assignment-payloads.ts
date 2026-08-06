// Armado de los bodies para POST /api/assignments cuando se asignan analistas
// a un ciclo de una HU.
//
// Una HU puede tener varios analistas QA trabajándola en el mismo ciclo. El
// modelo lo soporta de origen: el único unique es (testerId, storyId, cycleId),
// así que N analistas distintos conviven sin chocar. Cada analista es una
// TesterAssignment propia, con sus fases y sus registros diarios.

export interface PhaseInput {
  phase: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface BuildAssignmentPayloadsArgs {
  testerIds: string[];
  storyId: string;
  cycleId: string;
  status: string;
  notes: string | null;
  /** Plan de fases (solo Ciclo 1). Vacío ⇒ se envían startDate/endDate sueltas. */
  phases: PhaseInput[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD o "" si no hay término estimado
}

export type AssignmentPayload = Record<string, unknown>;

function toIsoDate(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();
}

export function buildAssignmentPayloads({
  testerIds,
  storyId,
  cycleId,
  status,
  notes,
  phases,
  startDate,
  endDate,
}: BuildAssignmentPayloadsArgs): AssignmentPayload[] {
  // Dedup preservando el orden de selección: repetir un analista violaría el
  // unique (testerId, storyId, cycleId) y devolvería un 409 confuso.
  const uniqueTesterIds = Array.from(new Set(testerIds));

  return uniqueTesterIds.map((testerId) => {
    const payload: AssignmentPayload = { testerId, storyId, cycleId, status, notes };

    if (phases.length > 0) {
      // Copia por analista: cada assignment debe poder editar sus fases sin
      // arrastrar a los demás.
      payload.phases = phases.map((p) => ({ ...p }));
    } else {
      payload.startDate = toIsoDate(startDate);
      payload.endDate = endDate ? toIsoDate(endDate) : null;
    }

    return payload;
  });
}
