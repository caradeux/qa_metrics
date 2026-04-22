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
  capacityHours: number;
  activityHours: number;
  byCategory: CategoryBreakdown[];
  byAssignment: AssignmentBreakdown[];
  productiveHoursEstimate: number;
  occupationPct: number;
  overallocated: boolean;
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
  const capacityHours = workdays * 8 * allocationPct;

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
  const perCategory = new Map<string, CategoryBreakdown>();
  const perAssignment = new Map<string, AssignmentBreakdown>();

  for (const a of activities) {
    const start = a.startAt > from ? a.startAt : from;
    const end = a.endAt < to ? a.endAt : to;
    const hours = hoursBetween(start, end);
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
    capacityHours,
    activityHours: Math.round(activityHours * 100) / 100,
    byCategory: [...perCategory.values()],
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
      const capacityHours = workdays * 8 * allocationPct;

      let activityHours = 0;
      const perCategory = new Map<string, CategoryBreakdown>();
      const perAssignment = new Map<string, AssignmentBreakdown>();

      for (const a of activitiesByTester.get(tid) ?? []) {
        const start = a.startAt > from ? a.startAt : from;
        const end = a.endAt < to ? a.endAt : to;
        const hours = hoursBetween(start, end);
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
        capacityHours,
        activityHours: Math.round(activityHours * 100) / 100,
        byCategory: [...perCategory.values()],
        byAssignment: [...perAssignment.values()],
        productiveHoursEstimate: Math.round(productiveHoursEstimate * 100) / 100,
        occupationPct: Math.round(occupationPct * 100) / 100,
        overallocated,
      } satisfies OccupationResult;
    })
    .filter((r): r is OccupationResult => r !== null);
}
