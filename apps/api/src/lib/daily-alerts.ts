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

import { prisma, AssignmentStatus } from "@qa-metrics/database";

const EXCLUDED_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.ON_HOLD,
  AssignmentStatus.PRODUCTION,
  AssignmentStatus.UAT,
  AssignmentStatus.WAITING_UAT,
];

export interface MissingAssignment {
  assignmentId: string;
  storyId: string;
  storyExternalId: string | null;
  storyTitle: string;
  projectId: string;
  projectName: string;
  status: string;
}

export interface TesterWithMissing {
  testerId: string;
  testerName: string;
  email: string;
  missingAssignments: MissingAssignment[];
}

export async function findTestersWithMissingRecords(
  day: Date,
): Promise<TesterWithMissing[]> {
  const dayStart = new Date(day);
  dayStart.setUTCHours(0, 0, 0, 0);

  // Testers with user linked + email; load active assignments and any DailyRecord for the day.
  const testers = await prisma.tester.findMany({
    where: {
      user: { email: { not: undefined }, active: true },
    },
    select: {
      id: true,
      name: true,
      user: { select: { email: true } },
      assignments: {
        where: {
          status: { notIn: EXCLUDED_STATUSES },
          startDate: { lte: dayStart },
          OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
        },
        select: {
          id: true,
          status: true,
          storyId: true,
          story: {
            select: {
              id: true,
              externalId: true,
              title: true,
              projectId: true,
              project: { select: { id: true, name: true } },
            },
          },
          dailyRecords: {
            where: { date: dayStart },
            select: { id: true },
          },
        },
      },
    },
  });

  const out: TesterWithMissing[] = [];
  for (const t of testers) {
    if (!t.user?.email) continue;
    const missing = t.assignments.filter((a) => a.dailyRecords.length === 0);
    if (missing.length === 0) continue;
    out.push({
      testerId: t.id,
      testerName: t.name,
      email: t.user.email,
      missingAssignments: missing.map((a) => ({
        assignmentId: a.id,
        storyId: a.story.id,
        storyExternalId: a.story.externalId,
        storyTitle: a.story.title,
        projectId: a.story.project.id,
        projectName: a.story.project.name,
        status: a.status,
      })),
    });
  }
  return out;
}
