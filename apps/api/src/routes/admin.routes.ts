import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { ZodError } from "zod";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { dailyLoadQuerySchema } from "../validators/admin.validator.js";
import { toUtcDateOnly } from "../lib/workdays.js";

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
        },
      })
    : [];

  type DailyAgg = { loaded: boolean; storiesCount: number; designed: number; executed: number; defects: number; lastAt: Date | null };
  const dailyByUser = new Map<string, DailyAgg>();
  const assignmentsByUser = new Map<string, Set<string>>();
  for (const r of dailyRecords) {
    const userId = userByTesterId.get(r.testerId);
    if (!userId) continue;
    let agg = dailyByUser.get(userId);
    if (!agg) {
      agg = { loaded: true, storiesCount: 0, designed: 0, executed: 0, defects: 0, lastAt: null };
      dailyByUser.set(userId, agg);
      assignmentsByUser.set(userId, new Set());
    }
    assignmentsByUser.get(userId)!.add(r.assignmentId);
    agg.designed += r.designed;
    agg.executed += r.executed;
    agg.defects += r.defects;
    const at = r.updatedAt ?? r.createdAt;
    if (!agg.lastAt || at > agg.lastAt) agg.lastAt = at;
  }
  for (const [userId, agg] of dailyByUser) {
    agg.storiesCount = assignmentsByUser.get(userId)?.size ?? 0;
  }

  const activities = testerIds.length
    ? await prisma.activity.findMany({
        where: {
          testerId: { in: testerIds },
          startAt: { gte: dayUtc, lt: nextDayUtc },
        },
        select: { testerId: true, startAt: true, endAt: true, createdAt: true },
      })
    : [];

  type ActAgg = { hours: number; lastAt: Date | null };
  const actByUser = new Map<string, ActAgg>();
  for (const a of activities) {
    const userId = userByTesterId.get(a.testerId);
    if (!userId) continue;
    const hours = (a.endAt.getTime() - a.startAt.getTime()) / 3_600_000;
    let agg = actByUser.get(userId);
    if (!agg) {
      agg = { hours: 0, lastAt: null };
      actByUser.set(userId, agg);
    }
    agg.hours += hours;
    if (!agg.lastAt || a.createdAt > agg.lastAt) agg.lastAt = a.createdAt;
  }

  const rows = users.map((u) => {
    const d = dailyByUser.get(u.id);
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
          }
        : { loaded: false, storiesCount: 0, designed: 0, executed: 0, defects: 0, lastAt: null },
      activities: (() => {
        const a = actByUser.get(u.id);
        return a
          ? { loaded: true, hours: Math.round(a.hours * 100) / 100, lastAt: a.lastAt!.toISOString() }
          : { loaded: false, hours: 0, lastAt: null };
      })(),
    };
  });

  res.json({ date: dateStr, isNonBusinessDay, rows });
});

export default router;
