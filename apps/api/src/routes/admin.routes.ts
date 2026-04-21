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

  const rows = users.map((u) => ({
    userId: u.id,
    userName: u.name,
    userEmail: u.email,
    daily: { loaded: false, storiesCount: 0, designed: 0, executed: 0, defects: 0, lastAt: null as string | null },
    activities: { loaded: false, hours: 0, lastAt: null as string | null },
  }));

  res.json({ date: dateStr, isNonBusinessDay, rows });
});

export default router;
