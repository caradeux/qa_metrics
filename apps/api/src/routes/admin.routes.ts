import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { ZodError } from "zod";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { dailyLoadQuerySchema } from "../validators/admin.validator.js";
import { toUtcDateOnly } from "../lib/workdays.js";
import { ACTIVE_STATUSES, type AssignmentStatus } from "../lib/assignment-states.js";

const router = Router();
router.use(authMiddleware as any);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role?.name !== "ADMIN") {
    res.status(403).json({ error: "Solo ADMIN" });
    return false;
  }
  return true;
}

// GET /api/admin/daily-load?date=YYYY-MM-DD
router.get("/daily-load", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    dailyLoadQuerySchema.parse(req.query);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    throw e;
  }

  const dateStr = (req.query.date as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  const dayUtc = toUtcDateOnly(dateStr);
  const nextDayUtc = new Date(dayUtc);
  nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);

  const dow = dayUtc.getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  const holiday = await prisma.holiday.findUnique({ where: { date: dayUtc } });
  const isNonBusinessDay = isWeekend || !!holiday;

  // Analistas activos con al menos un Tester vinculado (testers.some).
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: { name: "QA_ANALYST" },
      testers: { some: {} },
    },
    select: {
      id: true,
      email: true,
      name: true,
      testers: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const testerIds = users.flatMap((u) => u.testers.map((t) => t.id));
  const userByTesterId = new Map<string, string>();
  for (const u of users) for (const t of u.testers) userByTesterId.set(t.id, u.id);

  const dailyRecords = testerIds.length
    ? await prisma.dailyRecord.findMany({
        where: { testerId: { in: testerIds }, date: dayUtc },
        select: {
          testerId: true,
          assignmentId: true,
          designed: true,
          executed: true,
          defects: true,
          updatedAt: true,
          createdAt: true,
          assignment: {
            select: {
              id: true,
              story: {
                select: {
                  id: true,
                  title: true,
                  externalId: true,
                  project: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })
    : [];

  type DailyEntry = {
    projectId: string;
    projectName: string;
    storyId: string;
    storyTitle: string;
    storyExternalId: string | null;
    designed: number;
    executed: number;
    defects: number;
  };
  type DailyAgg = {
    loaded: boolean;
    storiesCount: number;
    designed: number;
    executed: number;
    defects: number;
    lastAt: Date | null;
    entriesByAssignment: Map<string, DailyEntry>;
  };
  const dailyByUser = new Map<string, DailyAgg>();
  for (const r of dailyRecords) {
    const userId = userByTesterId.get(r.testerId);
    if (!userId) continue;
    let agg = dailyByUser.get(userId);
    if (!agg) {
      agg = {
        loaded: true, storiesCount: 0,
        designed: 0, executed: 0, defects: 0,
        lastAt: null,
        entriesByAssignment: new Map(),
      };
      dailyByUser.set(userId, agg);
    }
    agg.designed += r.designed;
    agg.executed += r.executed;
    agg.defects += r.defects;
    const at = r.updatedAt ?? r.createdAt;
    if (!agg.lastAt || at > agg.lastAt) agg.lastAt = at;

    const story = r.assignment.story;
    const project = story.project;
    let entry = agg.entriesByAssignment.get(r.assignmentId);
    if (!entry) {
      entry = {
        projectId: project.id,
        projectName: project.name,
        storyId: story.id,
        storyTitle: story.title,
        storyExternalId: story.externalId ?? null,
        designed: 0, executed: 0, defects: 0,
      };
      agg.entriesByAssignment.set(r.assignmentId, entry);
    }
    entry.designed += r.designed;
    entry.executed += r.executed;
    entry.defects += r.defects;
  }
  for (const agg of dailyByUser.values()) {
    agg.storiesCount = agg.entriesByAssignment.size;
  }

  const activities = testerIds.length
    ? await prisma.activity.findMany({
        where: {
          testerId: { in: testerIds },
          startAt: { gte: dayUtc, lt: nextDayUtc },
        },
        select: {
          testerId: true,
          startAt: true,
          endAt: true,
          createdAt: true,
          category: { select: { name: true } },
          assignment: {
            select: {
              story: {
                select: {
                  title: true,
                  externalId: true,
                  project: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })
    : [];

  type ActEntry = {
    categoryName: string;
    hours: number;
    projectName: string | null;
    storyTitle: string | null;
    storyExternalId: string | null;
  };
  type ActAgg = { hours: number; lastAt: Date | null; entries: ActEntry[] };
  const actByUser = new Map<string, ActAgg>();
  for (const a of activities) {
    const userId = userByTesterId.get(a.testerId);
    if (!userId) continue;
    const hours = (a.endAt.getTime() - a.startAt.getTime()) / 3_600_000;
    let agg = actByUser.get(userId);
    if (!agg) {
      agg = { hours: 0, lastAt: null, entries: [] };
      actByUser.set(userId, agg);
    }
    agg.hours += hours;
    if (!agg.lastAt || a.createdAt > agg.lastAt) agg.lastAt = a.createdAt;
    agg.entries.push({
      categoryName: a.category.name,
      hours: Math.round(hours * 100) / 100,
      projectName: a.assignment?.story?.project.name ?? null,
      storyTitle: a.assignment?.story?.title ?? null,
      storyExternalId: a.assignment?.story?.externalId ?? null,
    });
  }

  // Asignaciones activas esperadas en el día (para filas sin carga)
  const expected = testerIds.length
    ? await prisma.testerAssignment.findMany({
        where: {
          testerId: { in: testerIds },
          status: { in: [...ACTIVE_STATUSES] as AssignmentStatus[] },
          startDate: { lte: dayUtc },
          OR: [{ endDate: null }, { endDate: { gte: dayUtc } }],
        },
        select: {
          testerId: true,
          status: true,
          story: {
            select: {
              id: true,
              title: true,
              externalId: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  type ExpectedEntry = {
    projectId: string;
    projectName: string;
    storyId: string;
    storyTitle: string;
    storyExternalId: string | null;
    status: string;
  };
  const expectedByUser = new Map<string, ExpectedEntry[]>();
  for (const e of expected) {
    const userId = userByTesterId.get(e.testerId);
    if (!userId) continue;
    let arr = expectedByUser.get(userId);
    if (!arr) { arr = []; expectedByUser.set(userId, arr); }
    arr.push({
      projectId: e.story.project.id,
      projectName: e.story.project.name,
      storyId: e.story.id,
      storyTitle: e.story.title,
      storyExternalId: e.story.externalId ?? null,
      status: e.status,
    });
  }

  const rows = users.map((u) => {
    const d = dailyByUser.get(u.id);
    const a = actByUser.get(u.id);
    const exp = expectedByUser.get(u.id) ?? [];
    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      daily: d
        ? {
            loaded: true,
            storiesCount: d.storiesCount,
            designed: d.designed,
            executed: d.executed,
            defects: d.defects,
            lastAt: d.lastAt ? d.lastAt.toISOString() : null,
            entries: Array.from(d.entriesByAssignment.values()),
          }
        : { loaded: false, storiesCount: 0, designed: 0, executed: 0, defects: 0, lastAt: null, entries: [] },
      activities: a
        ? {
            loaded: true,
            hours: Math.round(a.hours * 100) / 100,
            lastAt: a.lastAt!.toISOString(),
            entries: a.entries,
          }
        : { loaded: false, hours: 0, lastAt: null, entries: [] },
      expectedAssignments: exp,
    };
  });

  res.json({ date: dateStr, isNonBusinessDay, rows });
});

export default router;
