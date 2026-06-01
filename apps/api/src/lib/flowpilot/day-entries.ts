import { prisma } from "@qa-metrics/database";
import { distributeHours } from "./hours-distribution.js";

const MS_PER_HOUR = 1000 * 60 * 60;
const WORKDAY_HOURS = 8;

const ABSENCE_NAMES = new Set([
  "vacaciones", "ausencia", "licencia", "licencia médica", "licencia medica",
  "permiso", "feriado", "día administrativo", "dia administrativo",
]);
function isAbsence(name: string, bandType?: string | null): boolean {
  if (bandType === "ABSENCE") return true;
  return ABSENCE_NAMES.has(name.trim().toLowerCase());
}
// Categoría de ausencia → kind homologable.
function absenceKind(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes("vacacion")) return "VACACIONES";
  if (n.includes("licencia")) return "LICENCIA";
  if (n.includes("feriado")) return "FERIADO";
  return "VACACIONES";
}

export interface PreviewEntry {
  kind: string;
  description: string;
  hours: number;
  source: "activity" | "story";
  refId: string;
  mapped: boolean;
  destination: {
    entityType: string; clientId: number; clientName: string;
    contractId: number | null; projectId: number | null;
    entityName: string; taskTypeId: number; taskTypeName: string;
  } | null;
}

export interface DayPreview {
  date: string;
  capacityHours: number;
  totalHours: number;
  allMapped: boolean;
  withinCap: boolean;
  entries: PreviewEntry[];
}

export async function buildDayPreview(userId: string, date: string): Promise<DayPreview> {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * MS_PER_HOUR);

  const testers = await prisma.tester.findMany({
    where: { userId },
    select: { id: true, allocation: true },
  });
  const testerIds = testers.map((t) => t.id);
  const capacityHours = Math.min(
    WORKDAY_HOURS,
    testers.reduce((s, t) => s + WORKDAY_HOURS * (t.allocation / 100), 0) || WORKDAY_HOURS,
  );

  const [activities, records, mappings] = await Promise.all([
    prisma.activity.findMany({
      where: { testerId: { in: testerIds }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      include: { category: true },
    }),
    prisma.dailyRecord.findMany({
      where: { testerId: { in: testerIds }, date: dayStart },
      include: { assignment: { include: { story: { select: { externalId: true, title: true } } } } },
    }),
    prisma.flowpilotMapping.findMany({ where: { userId } }),
  ]);
  const mapByKind = new Map(mappings.map((m) => [m.kind, m]));

  const entries: PreviewEntry[] = [];
  let activityHours = 0;
  let absenceHours = 0;

  for (const a of activities) {
    const start = a.startAt > dayStart ? a.startAt : dayStart;
    const end = a.endAt < dayEnd ? a.endAt : dayEnd;
    const hours = Math.max(0, (end.getTime() - start.getTime()) / MS_PER_HOUR);
    if (hours <= 0) continue;
    const absence = isAbsence(a.category.name, (a.category as any).bandType);
    const kind = absence ? absenceKind(a.category.name) : "QA_WORK";
    if (absence) absenceHours += hours; else activityHours += hours;
    entries.push(makeEntry(kind, `${a.category.name}${a.notes ? ` — ${a.notes}` : ""}`, hours, "activity", a.id, mapByKind));
  }

  const productive = Math.max(0, Math.min(WORKDAY_HOURS, capacityHours) - activityHours - absenceHours);
  const weighted = records.map((r) => ({ key: r.assignmentId, weight: r.designed + r.executed + r.defects }));
  const dist = distributeHours(weighted, productive, 0.5);
  for (const r of records) {
    const hours = dist.get(r.assignmentId) ?? 0;
    if (hours <= 0) continue;
    const st = r.assignment?.story;
    const desc = st ? (st.externalId ? `${st.externalId} — ${st.title}` : st.title) : "Trabajo QA";
    entries.push(makeEntry("QA_WORK", desc, hours, "story", r.assignmentId, mapByKind));
  }

  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;
  return {
    date,
    capacityHours: Math.round(capacityHours * 100) / 100,
    totalHours,
    allMapped: entries.every((e) => e.mapped),
    withinCap: totalHours <= WORKDAY_HOURS + 1e-9,
    entries,
  };
}

function makeEntry(
  kind: string, description: string, hours: number,
  source: "activity" | "story", refId: string,
  mapByKind: Map<string, any>,
): PreviewEntry {
  const m = mapByKind.get(kind);
  return {
    kind, description, hours: Math.round(hours * 100) / 100, source, refId,
    mapped: !!m,
    destination: m ? {
      entityType: m.entityType, clientId: m.clientId, clientName: m.clientName,
      contractId: m.contractId, projectId: m.projectId, entityName: m.entityName,
      taskTypeId: m.taskTypeId, taskTypeName: m.taskTypeName,
    } : null,
  };
}
