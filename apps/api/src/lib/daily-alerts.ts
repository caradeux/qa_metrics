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

  // Testers with active user linked; load active assignments and any DailyRecord for the day.
  const testers = await prisma.tester.findMany({
    where: {
      user: { active: true },
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

  // Consolida por email: una persona con N filas Tester (N proyectos) recibe
  // UN solo correo con todas sus HUs faltantes, no N correos duplicados.
  const byEmail = new Map<string, TesterWithMissing>();
  for (const t of testers) {
    if (!t.user?.email) continue;
    const missing = t.assignments.filter((a) => a.dailyRecords.length === 0);
    if (missing.length === 0) continue;
    const mapped = missing.map((a) => ({
      assignmentId: a.id,
      storyId: a.story.id,
      storyExternalId: a.story.externalId,
      storyTitle: a.story.title,
      projectId: a.story.project.id,
      projectName: a.story.project.name,
      status: a.status,
    }));
    const existing = byEmail.get(t.user.email);
    if (existing) {
      existing.missingAssignments.push(...mapped);
    } else {
      byEmail.set(t.user.email, {
        testerId: t.id,
        testerName: t.name,
        email: t.user.email,
        missingAssignments: mapped,
      });
    }
  }
  return [...byEmail.values()];
}

export async function resolveCcRecipients(projectIds: string[]): Promise<string[]> {
  const [admins, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: { name: "ADMIN" }, active: true },
      select: { email: true },
    }),
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds }, projectManagerId: { not: null } },
          select: { projectManager: { select: { email: true, active: true } } },
        })
      : Promise.resolve([]),
  ]);

  const emails = new Set<string>();
  for (const a of admins) if (a.email) emails.add(a.email);
  for (const p of projects) {
    if (p.projectManager?.active && p.projectManager.email) {
      emails.add(p.projectManager.email);
    }
  }
  return [...emails];
}

import { sendMail } from "./mailer.js";
import { renderDailyAlert } from "../templates/daily-alert.js";

export interface RunResult {
  dayChecked: string;
  testersNotified: number;
  assignmentsFlagged: number;
  errors: Array<{ testerId?: string; email?: string; message: string }>;
  skipped?: boolean;
  reason?: string;
  payloads?: Array<{ to: string; cc: string[]; subject: string; html: string }>;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export async function runDailyAlerts(opts: {
  today?: Date;
  dryRun?: boolean;
  noCc?: boolean;
}): Promise<RunResult> {
  const today = opts.today ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const noCc = opts.noCc ?? false;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const replyTo = process.env.ALERT_REPLY_TO;
  const overrideTo = process.env.ALERT_OVERRIDE_TO?.trim() || undefined;

  const holidayRows = await prisma.holiday.findMany({ select: { date: true } });
  const holidays = holidayRows.map((h) => h.date);

  if (!isWorkday(today, holidays)) {
    return {
      dayChecked: "",
      testersNotified: 0,
      assignmentsFlagged: 0,
      errors: [],
      skipped: true,
      reason: "non-workday",
    };
  }

  const dayToCheck = previousWorkday(today, holidays);
  const testers = await findTestersWithMissingRecords(dayToCheck);

  const result: RunResult = {
    dayChecked: dayToCheck.toISOString().slice(0, 10),
    testersNotified: 0,
    assignmentsFlagged: 0,
    errors: [],
    payloads: dryRun ? [] : undefined,
  };

  const label = dayLabel(dayToCheck);

  for (const t of testers) {
    try {
      const projectIds = [...new Set(t.missingAssignments.map((a) => a.projectId))];
      const cc = noCc ? [] : await resolveCcRecipients(projectIds);
      const { subject, html } = renderDailyAlert({
        testerName: t.testerName,
        dayLabel: label,
        missingAssignments: t.missingAssignments,
        appUrl,
      });

      const effectiveTo = overrideTo ?? t.email;
      const effectiveCc = overrideTo ? [] : cc;
      const effectiveSubject = overrideTo
        ? `[TEST override → ${t.email}] ${subject}`
        : subject;

      if (dryRun) {
        result.payloads!.push({
          to: effectiveTo,
          cc: effectiveCc,
          subject: effectiveSubject,
          html,
        });
      } else {
        await sendMail({
          to: effectiveTo,
          cc: effectiveCc,
          subject: effectiveSubject,
          html,
          replyTo,
        });
      }

      result.testersNotified += 1;
      result.assignmentsFlagged += t.missingAssignments.length;
    } catch (err: any) {
      result.errors.push({
        testerId: t.testerId,
        email: t.email,
        message: err?.message ?? String(err),
      });
    }
  }

  return result;
}
