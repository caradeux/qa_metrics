import { prisma } from "@qa-metrics/database";
import { workdaysInRange } from "./workdays.js";

const MS_PER_HOUR = 1000 * 60 * 60;

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  color: string | null;
  hours: number;
}

export interface AssignmentBreakdown {
  assignmentId: string;
  storyTitle: string;
  hours: number;
}

export interface OccupationResult {
  testerId: string;
  testerName: string;
  periodDays: number;
  workdays: number;
  nominalCapacityHours: number;      // capacidad antes de descontar ausencias
  absenceHours: number;              // vacaciones, licencias, permisos, etc.
  capacityHours: number;             // nominal - absence (lo que aparece en cards)
  activityHours: number;             // reuniones + actividades NO absence
  byCategory: CategoryBreakdown[];   // sin categorías de ausencia
  byAbsence: CategoryBreakdown[];    // solo categorías de ausencia
  byAssignment: AssignmentBreakdown[];
  productiveHoursEstimate: number;   // capacityHours - activityHours
  occupationPct: number;
  overallocated: boolean;
}

const ABSENCE_CATEGORY_NAMES = new Set([
  "vacaciones",
  "ausencia",
  "licencia",
  "licencia médica",
  "licencia medica",
  "permiso",
  "feriado",
  "día administrativo",
  "dia administrativo",
]);

function isAbsence(name: string): boolean {
  return ABSENCE_CATEGORY_NAMES.has(name.trim().toLowerCase());
}

function hoursBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / MS_PER_HOUR);
}

export async function computeOccupation(
  testerId: string,
  from: Date,
  to: Date
): Promise<OccupationResult> {
  const tester = await prisma.tester.findUniqueOrThrow({
    where: { id: testerId },
    select: { id: true, name: true, allocation: true },
  });

  const workdays = (await workdaysInRange(from, to)).length;
  const allocationPct = tester.allocation / 100;
  const nominalCapacityHours = workdays * 8 * allocationPct;

  // Actividades que se traslapan con el rango.
  const activities = await prisma.activity.findMany({
    where: {
      testerId,
      startAt: { lt: to },
      endAt: { gt: from },
    },
    include: {
      category: true,
      assignment: { include: { story: { select: { title: true } } } },
    },
  });

  let activityHours = 0;
  let absenceHours = 0;
  const perCategory = new Map<string, CategoryBreakdown>();
  const perAbsence = new Map<string, CategoryBreakdown>();
  const perAssignment = new Map<string, AssignmentBreakdown>();

  for (const a of activities) {
    const start = a.startAt > from ? a.startAt : from;
    const end = a.endAt < to ? a.endAt : to;
    const hours = hoursBetween(start, end);
    const absence = isAbsence(a.category.name);

    if (absence) {
      absenceHours += hours;
      const cat = perAbsence.get(a.categoryId) ?? {
        categoryId: a.categoryId,
        name: a.category.name,
        color: a.category.color,
        hours: 0,
      };
      cat.hours += hours;
      perAbsence.set(a.categoryId, cat);
    } else {
      activityHours += hours;
      const cat = perCategory.get(a.categoryId) ?? {
        categoryId: a.categoryId,
        name: a.category.name,
        color: a.category.color,
        hours: 0,
      };
      cat.hours += hours;
      perCategory.set(a.categoryId, cat);

      if (a.assignmentId && a.assignment) {
        const asg = perAssignment.get(a.assignmentId) ?? {
          assignmentId: a.assignmentId,
          storyTitle: a.assignment.story?.title ?? "(sin historia)",
          hours: 0,
        };
        asg.hours += hours;
        perAssignment.set(a.assignmentId, asg);
      }
    }
  }

  const capacityHours = Math.max(0, nominalCapacityHours - absenceHours);
  const overallocated = activityHours > capacityHours;
  const productiveHoursEstimate = Math.max(0, capacityHours - activityHours);
  const occupationPct =
    capacityHours > 0
      ? Math.min(100, ((activityHours + productiveHoursEstimate) / capacityHours) * 100)
      : 0;

  const periodDays = Math.ceil((to.getTime() - from.getTime()) / (24 * MS_PER_HOUR));

  return {
    testerId: tester.id,
    testerName: tester.name,
    periodDays,
    workdays,
    nominalCapacityHours: Math.round(nominalCapacityHours * 100) / 100,
    absenceHours: Math.round(absenceHours * 100) / 100,
    capacityHours: Math.round(capacityHours * 100) / 100,
    activityHours: Math.round(activityHours * 100) / 100,
    byCategory: [...perCategory.values()],
    byAbsence: [...perAbsence.values()],
    byAssignment: [...perAssignment.values()],
    productiveHoursEstimate: Math.round(productiveHoursEstimate * 100) / 100,
    occupationPct: Math.round(occupationPct * 100) / 100,
    overallocated,
  };
}

// Versión batch: en vez de N×(2 queries) hace 2 queries totales.
// Mantiene exactamente la misma lógica de cálculo que computeOccupation
// y devuelve los resultados en el mismo orden que los testerIds recibidos.
export async function computeOccupationBatch(
  testerIds: string[],
  from: Date,
  to: Date
): Promise<OccupationResult[]> {
  if (testerIds.length === 0) return [];

  const [testers, activities, workdaysList] = await Promise.all([
    prisma.tester.findMany({
      where: { id: { in: testerIds } },
      select: { id: true, name: true, allocation: true },
    }),
    prisma.activity.findMany({
      where: {
        testerId: { in: testerIds },
        startAt: { lt: to },
        endAt: { gt: from },
      },
      include: {
        category: true,
        assignment: { include: { story: { select: { title: true } } } },
      },
    }),
    workdaysInRange(from, to),
  ]);

  const workdays = workdaysList.length;
  const periodDays = Math.ceil((to.getTime() - from.getTime()) / (24 * MS_PER_HOUR));

  const activitiesByTester = new Map<string, typeof activities>();
  for (const a of activities) {
    if (!activitiesByTester.has(a.testerId)) activitiesByTester.set(a.testerId, []);
    activitiesByTester.get(a.testerId)!.push(a);
  }

  const testerById = new Map(testers.map((t) => [t.id, t]));

  return testerIds
    .map((tid) => {
      const tester = testerById.get(tid);
      if (!tester) return null;

      const allocationPct = tester.allocation / 100;
      const nominalCapacityHours = workdays * 8 * allocationPct;

      let activityHours = 0;
      let absenceHours = 0;
      const perCategory = new Map<string, CategoryBreakdown>();
      const perAbsence = new Map<string, CategoryBreakdown>();
      const perAssignment = new Map<string, AssignmentBreakdown>();

      for (const a of activitiesByTester.get(tid) ?? []) {
        const start = a.startAt > from ? a.startAt : from;
        const end = a.endAt < to ? a.endAt : to;
        const hours = hoursBetween(start, end);
        const absence = isAbsence(a.category.name);

        if (absence) {
          absenceHours += hours;
          const cat = perAbsence.get(a.categoryId) ?? {
            categoryId: a.categoryId,
            name: a.category.name,
            color: a.category.color,
            hours: 0,
          };
          cat.hours += hours;
          perAbsence.set(a.categoryId, cat);
        } else {
          activityHours += hours;
          const cat = perCategory.get(a.categoryId) ?? {
            categoryId: a.categoryId,
            name: a.category.name,
            color: a.category.color,
            hours: 0,
          };
          cat.hours += hours;
          perCategory.set(a.categoryId, cat);

          if (a.assignmentId && a.assignment) {
            const asg = perAssignment.get(a.assignmentId) ?? {
              assignmentId: a.assignmentId,
              storyTitle: a.assignment.story?.title ?? "(sin historia)",
              hours: 0,
            };
            asg.hours += hours;
            perAssignment.set(a.assignmentId, asg);
          }
        }
      }

      const capacityHours = Math.max(0, nominalCapacityHours - absenceHours);
      const overallocated = activityHours > capacityHours;
      const productiveHoursEstimate = Math.max(0, capacityHours - activityHours);
      const occupationPct =
        capacityHours > 0
          ? Math.min(100, ((activityHours + productiveHoursEstimate) / capacityHours) * 100)
          : 0;

      return {
        testerId: tester.id,
        testerName: tester.name,
        periodDays,
        workdays,
        nominalCapacityHours: Math.round(nominalCapacityHours * 100) / 100,
        absenceHours: Math.round(absenceHours * 100) / 100,
        capacityHours: Math.round(capacityHours * 100) / 100,
        activityHours: Math.round(activityHours * 100) / 100,
        byCategory: [...perCategory.values()],
        byAbsence: [...perAbsence.values()],
        byAssignment: [...perAssignment.values()],
        productiveHoursEstimate: Math.round(productiveHoursEstimate * 100) / 100,
        occupationPct: Math.round(occupationPct * 100) / 100,
        overallocated,
      } satisfies OccupationResult;
    })
    .filter((r): r is OccupationResult => r !== null);
}

// ═══════════════════════════════════════════════════════════════════
// Agrupar resultados por persona (User.id) y capear la capacidad al
// máximo físico de 8h/día × días hábiles. Evita mostrar 60h o 45h cuando
// una persona está asignada a varios proyectos con allocations que suman
// > 100%. Refleja la sobre-asignación con el flag `overallocated`.
// ═══════════════════════════════════════════════════════════════════

export async function aggregateOccupationByUser(
  results: OccupationResult[]
): Promise<OccupationResult[]> {
  if (results.length === 0) return [];

  // Resolver userId de cada Tester para hacer el grouping.
  const testerIds = [...new Set(results.map((r) => r.testerId))];
  const testers = await prisma.tester.findMany({
    where: { id: { in: testerIds } },
    select: { id: true, userId: true },
  });
  const testerIdToUserId = new Map(testers.map((t) => [t.id, t.userId ?? null]));

  const byPerson = new Map<string, OccupationResult>();
  for (const r of results) {
    const uid = testerIdToUserId.get(r.testerId) ?? null;
    const key = uid ?? `anon:${r.testerId}`;
    const prev = byPerson.get(key);
    if (!prev) {
      byPerson.set(key, {
        ...r,
        byCategory: [...r.byCategory],
        byAbsence: [...r.byAbsence],
        byAssignment: [...r.byAssignment],
      });
      continue;
    }
    prev.nominalCapacityHours = Math.round((prev.nominalCapacityHours + r.nominalCapacityHours) * 100) / 100;
    prev.absenceHours = Math.round((prev.absenceHours + r.absenceHours) * 100) / 100;
    prev.capacityHours = Math.round((prev.capacityHours + r.capacityHours) * 100) / 100;
    prev.activityHours = Math.round((prev.activityHours + r.activityHours) * 100) / 100;
    prev.productiveHoursEstimate = Math.round((prev.productiveHoursEstimate + r.productiveHoursEstimate) * 100) / 100;

    const mergeArr = <T extends { hours: number }>(target: T[], incoming: T[], keyFn: (x: T) => string) => {
      for (const item of incoming) {
        const k = keyFn(item);
        const existing = target.find((t) => keyFn(t) === k);
        if (existing) existing.hours = Math.round((existing.hours + item.hours) * 100) / 100;
        else target.push({ ...item });
      }
    };
    mergeArr(prev.byCategory, r.byCategory, (x) => x.categoryId);
    mergeArr(prev.byAbsence, r.byAbsence, (x) => x.categoryId);
    mergeArr(prev.byAssignment, r.byAssignment, (x) => x.assignmentId);
  }

  // Cap físico: workdays × 8h. Recalcular derivados post-cap.
  return Array.from(byPerson.values()).map((a) => {
    const physicalMax = a.workdays * 8;
    const wasOverByAllocation = a.nominalCapacityHours > physicalMax;
    const nominal = Math.min(a.nominalCapacityHours, physicalMax);
    const capacity = Math.max(0, nominal - a.absenceHours);
    const productive = Math.max(0, capacity - a.activityHours);
    const occupationPct = capacity > 0
      ? Math.round(Math.min(100, (a.activityHours + productive) / capacity * 100) * 100) / 100
      : 0;
    return {
      ...a,
      nominalCapacityHours: Math.round(nominal * 100) / 100,
      capacityHours: Math.round(capacity * 100) / 100,
      productiveHoursEstimate: Math.round(productive * 100) / 100,
      occupationPct,
      overallocated: wasOverByAllocation || a.activityHours > capacity,
    } satisfies OccupationResult;
  });
}
