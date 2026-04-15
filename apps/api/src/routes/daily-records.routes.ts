import { Router, Response } from "express";
import { z } from "zod";
import { addDays, startOfDay } from "date-fns";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { ACTIVE_STATUSES } from "../lib/assignment-states.js";

const router = Router();
router.use(authMiddleware as any);

const bulkSchema = z.object({
  testerId: z.string().cuid(),
  entries: z
    .array(
      z.object({
        assignmentId: z.string().cuid(),
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

async function canReadTester(req: AuthRequest, testerId: string): Promise<boolean> {
  const roleName = req.user?.role?.name;
  if (roleName === "ADMIN" || roleName === "QA_LEAD") return true;
  const tester = await prisma.tester.findUnique({
    where: { id: testerId },
    select: { userId: true, projectId: true },
  });
  if (!tester) return false;
  if (roleName === "CLIENT_PM") {
    const p = await prisma.project.findFirst({
      where: { id: tester.projectId, projectManagerId: req.user!.id },
      select: { id: true },
    });
    return !!p;
  }
  return tester.userId === req.user?.id;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function enumerateWeekdaysInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = startOfDay(new Date(start));
  const last = startOfDay(new Date(end));
  while (cur <= last) {
    const dow = cur.getDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 5) out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
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
  if (!(await canReadTester(req, parsed.data.testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const monday = startOfDay(new Date(parsed.data.weekStart + "T00:00:00"));
  const friday = addDays(monday, 4);
  const today = startOfDay(new Date());

  // Build week days
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: monday, lte: friday } },
  });
  const holidayMap = new Map(holidays.map((h) => [toISODate(h.date), h.name]));
  const days: Array<{
    date: string;
    isHoliday: boolean;
    holidayName: string | null;
    isFuture: boolean;
  }> = [];
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    const key = toISODate(d);
    days.push({
      date: key,
      isHoliday: holidayMap.has(key),
      holidayName: holidayMap.get(key) ?? null,
      isFuture: d > today,
    });
  }

  const includeIdle = req.query.includeIdle === "true";

  // Get assignments overlapping the week. By default ACTIVE statuses + RETURNED_TO_DEV
  // (returned HUs can still receive bug reports / late executions during the week).
  const defaultStatuses = [...ACTIVE_STATUSES, "RETURNED_TO_DEV"];
  const assignments = await prisma.testerAssignment.findMany({
    where: {
      testerId: parsed.data.testerId,
      startDate: { lte: friday },
      OR: [{ endDate: null }, { endDate: { gte: monday } }],
      ...(includeIdle ? {} : { status: { in: defaultStatuses } }),
    },
    include: {
      story: { select: { id: true, title: true, externalId: true } },
      cycle: { select: { id: true, name: true } },
      dailyRecords: {
        where: { date: { gte: monday, lte: friday } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = assignments.map((a) => {
    const rangeEnd = a.endDate ?? today;
    const effectiveEnd = rangeEnd < friday ? rangeEnd : friday;
    const effectiveStart = a.startDate > monday ? a.startDate : monday;
    const activeOnDates =
      effectiveEnd < effectiveStart
        ? []
        : enumerateWeekdaysInRange(effectiveStart, effectiveEnd);
    return {
      id: a.id,
      story: a.story,
      cycle: a.cycle,
      status: a.status,
      startDate: toISODate(a.startDate),
      endDate: a.endDate ? toISODate(a.endDate) : null,
      activeOnDates,
      records: a.dailyRecords.map((r) => ({
        date: toISODate(r.date),
        designed: r.designed,
        executed: r.executed,
        defects: r.defects,
      })),
    };
  });

  res.json({
    weekStart: parsed.data.weekStart,
    days,
    assignments: result,
  });
});

router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { testerId, entries } = parsed.data;
  if (!(await canActOn(req, testerId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const today = startOfDay(new Date());
  const dates = entries.map((e) => new Date(e.date + "T00:00:00"));
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

  // Validate assignments belong to tester and dates are within range
  const assignmentIds = [...new Set(entries.map((e) => e.assignmentId))];
  const assignments = await prisma.testerAssignment.findMany({
    where: { id: { in: assignmentIds } },
    select: {
      id: true,
      testerId: true,
      startDate: true,
      endDate: true,
    },
  });
  const aMap = new Map(assignments.map((a) => [a.id, a]));
  for (const e of entries) {
    const a = aMap.get(e.assignmentId);
    if (!a) {
      res.status(400).json({ error: `asignación inválida: ${e.assignmentId}` });
      return;
    }
    if (a.testerId !== testerId) {
      res.status(403).json({ error: "asignación no pertenece al tester" });
      return;
    }
    const d = new Date(e.date + "T00:00:00");
    const start = startOfDay(a.startDate);
    const end = a.endDate ? startOfDay(a.endDate) : today;
    if (d < start || d > end) {
      res
        .status(400)
        .json({ error: `fecha ${e.date} fuera del rango de la asignación` });
      return;
    }
  }

  await prisma.$transaction(
    entries.map((e) =>
      prisma.dailyRecord.upsert({
        where: {
          assignmentId_date: {
            assignmentId: e.assignmentId,
            date: new Date(e.date + "T00:00:00"),
          },
        },
        create: {
          testerId,
          assignmentId: e.assignmentId,
          date: new Date(e.date + "T00:00:00"),
          designed: e.designed,
          executed: e.executed,
          defects: e.defects,
        },
        update: {
          designed: e.designed,
          executed: e.executed,
          defects: e.defects,
        },
      })
    )
  );
  res.json({ ok: true, updated: entries.length });
});

export default router;
