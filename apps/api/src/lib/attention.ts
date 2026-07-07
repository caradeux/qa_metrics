// Lógica pura para "Temas que requieren gestión" (modal de alertas).
//
// Regla clave: la alerta se levanta por HU (user story) según su CICLO ACTUAL,
// no por cada ciclo/asignación. El ciclo actual de una HU es el assignment más
// reciente (por createdAt) entre TODOS sus ciclos — incluidos los cerrados en
// PRODUCTION. Un ciclo previo devuelto/estancado ya no debe alertar si la HU
// avanzó a un ciclo nuevo. Ver `pptx-status-derivation` para el pitfall de
// derivar el estado actual desde un subconjunto pre-filtrado por status.

// Umbral (en días) para marcar el ciclo actual como "estancado" en su estado.
export const STUCK_DAYS = 14;

export type AttentionReason = "returned" | "on_hold" | "stuck" | "overdue";

export type AttentionAssignment = {
  id: string;
  status: string;
  endDate: Date | null;
  updatedAt: Date;
  createdAt: Date;
  statusLogs: { changedAt: Date }[];
  story: { id: string; title: string; externalId: string | null };
  tester: {
    name: string | null;
    project: { id: string; name: string; client: { name: string } };
  };
};

export type AttentionItem = {
  assignmentId: string;
  storyId: string;
  storyTitle: string;
  externalId: string | null;
  projectId: string;
  projectName: string;
  clientName: string;
  testerName: string | null;
  status: string;
  daysInStatus: number;
  endDate: Date | null;
  reasons: AttentionReason[];
};

/**
 * Colapsa las asignaciones (una por tester × HU × ciclo) a una sola alerta por
 * HU, evaluando únicamente el ciclo actual (assignment más reciente por HU).
 */
export function buildAttentionItems(
  assignments: AttentionAssignment[],
  opts: { now: number; stuckDays?: number }
): AttentionItem[] {
  const stuckDays = opts.stuckDays ?? STUCK_DAYS;

  // Ciclo actual por HU = assignment más reciente (createdAt) entre TODOS los ciclos.
  const currentByStory = new Map<string, AttentionAssignment>();
  for (const a of assignments) {
    const cur = currentByStory.get(a.story.id);
    if (!cur || a.createdAt.getTime() > cur.createdAt.getTime()) {
      currentByStory.set(a.story.id, a);
    }
  }

  const items: AttentionItem[] = [];
  for (const a of currentByStory.values()) {
    if (a.status === "PRODUCTION") continue; // ciclo actual cerrado → no requiere gestión

    const lastLog = a.statusLogs[0];
    const since = lastLog ? lastLog.changedAt : a.updatedAt;
    const days = Math.floor((opts.now - since.getTime()) / 86400000);

    const reasons: AttentionReason[] = [];
    if (a.status === "RETURNED_TO_DEV") reasons.push("returned");
    if (a.status === "ON_HOLD") reasons.push("on_hold");
    if (days > stuckDays) reasons.push("stuck");
    if (a.endDate && a.endDate.getTime() < opts.now) reasons.push("overdue");
    if (reasons.length === 0) continue;

    items.push({
      assignmentId: a.id,
      storyId: a.story.id,
      storyTitle: a.story.title,
      externalId: a.story.externalId,
      projectId: a.tester.project.id,
      projectName: a.tester.project.name,
      clientName: a.tester.project.client.name,
      testerName: a.tester.name,
      status: a.status,
      daysInStatus: days,
      endDate: a.endDate,
      reasons,
    });
  }

  // Más severos primero: más motivos, luego más días en estado.
  items.sort((x, y) => y.reasons.length - x.reasons.length || y.daysInStatus - x.daysInStatus);
  return items;
}
