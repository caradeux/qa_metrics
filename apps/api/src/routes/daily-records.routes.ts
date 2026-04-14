import { Router, Response } from "express";
import { z } from "zod";
import { addDays, startOfDay } from "date-fns";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

const bulkSchema = z.object({
  testerId: z.string().cuid(),
  cycleId: z.string().cuid(),
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        designed: z.number().int().min(0),
        executed: z.number().int().min(0),
        defects: z.number().int().min(0),
      })
    )
    .min(1),
});

async function canActOn(req: AuthRequest, testerId: string): Promise<boolean> {
  const roleName = req.user?.role?.name;
  if (roleName === "ADMIN" || roleName === "QA_LEAD") return true;
  const tester = await prisma.tester.findUnique({ where: { id: testerId } });
  return tester?.userId === req.user?.id;
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const parsed = z
    .object({
      testerId: z.string().cuid(),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!(await canActOn(req, parsed.data.testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const monday = startOfDay(new Date(parsed.data.weekStart + "T00:00:00"));
  const friday = addDays(monday, 4);
  const [records, holidays] = await Promise.all([
    prisma.dailyRecord.findMany({
      where: {
        testerId: parsed.data.testerId,
        date: { gte: monday, lte: friday },
      },
    }),
    prisma.holiday.findMany({ where: { date: { gte: monday, lte: friday } } }),
  ]);
  const holidayMap = new Map(
    holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name])
  );
  const today = startOfDay(new Date());

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    const key = d.toISOString().slice(0, 10);
    const rec = records.find(
      (r) => r.date.toISOString().slice(0, 10) === key
    );
    days.push({
      date: key,
      designed: rec?.designed ?? 0,
      executed: rec?.executed ?? 0,
      defects: rec?.defects ?? 0,
      isHoliday: holidayMap.has(key),
      holidayName: holidayMap.get(key) ?? null,
      isFuture: d > today,
    });
  }
  res.json({ weekStart: parsed.data.weekStart, days });
});

router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { testerId, cycleId, days } = parsed.data;
  if (!(await canActOn(req, testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const today = startOfDay(new Date());
  const dates = days.map((d) => new Date(d.date + "T00:00:00"));
  if (dates.some((d) => d > today)) {
    res.status(400).json({ error: "no se permiten fechas futuras" });
    return;
  }

  const holidays = await prisma.holiday.findMany({
    where: { date: { in: dates } },
  });
  if (holidays.length > 0) {
    res.status(400).json({ error: "no se permite cargar feriados", holidays });
    return;
  }

  await prisma.$transaction(
    days.map((d) =>
      prisma.dailyRecord.upsert({
        where: {
          testerId_date: { testerId, date: new Date(d.date + "T00:00:00") },
        },
        create: {
          testerId,
          cycleId,
          date: new Date(d.date + "T00:00:00"),
          designed: d.designed,
          executed: d.executed,
          defects: d.defects,
        },
        update: {
          cycleId,
          designed: d.designed,
          executed: d.executed,
          defects: d.defects,
        },
      })
    )
  );
  res.json({ ok: true });
});

export default router;
