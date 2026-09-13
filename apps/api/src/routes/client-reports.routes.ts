import { Router, Response } from "express";
import { z } from "zod";
import { addMonths, startOfMonth, endOfMonth, format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { aggregateAutomationByPeriod } from "../services/automation-metrics.service.js";

const router = Router();
router.use(authMiddleware as any);

type ReportProject = { id: string; name: string; modality: string };

/**
 * Los proyectos de automatizacion no generan DailyRecord (diseñados/ejecutados/
 * defectos) sino AutomationRecord (scripts y ejecuciones), asi que el reporte
 * los agrega por separado. Las series por proyecto incluyen los proyectos
 * AUTOMATION y cualquier otro que tenga registros de automatizacion.
 */
async function automationSection(
  projects: ReportProject[],
  range: { start: Date; end: Date },
  periodKeys: string[],
  periodKeyFor: (calendarDate: Date) => string
) {
  const projectIds = projects.map((p) => p.id);
  // Las columnas @db.Date se comparan como medianoche UTC: el rango se lleva a
  // dias calendario UTC para no perder el primer dia en servidores UTC-N.
  const utcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const records =
    projectIds.length > 0
      ? await prisma.automationRecord.findMany({
          where: {
            date: { gte: utcDay(range.start), lte: utcDay(range.end) },
            assignment: { testLine: { projectId: { in: projectIds } } },
          },
          select: {
            date: true,
            scriptsCreated: true,
            scriptsRefactored: true,
            scriptsFixed: true,
            execTotal: true,
            execPassed: true,
            execFailed: true,
            assignment: { select: { testLine: { select: { projectId: true } } } },
          },
        })
      : [];

  const withRecords = new Set(records.map((r) => r.assignment.testLine.projectId));
  const seriesProjects = projects.filter((p) => p.modality === "AUTOMATION" || withRecords.has(p.id));
  const report = aggregateAutomationByPeriod(
    records.map(({ assignment, ...r }) => ({ ...r, projectId: assignment.testLine.projectId })),
    periodKeys,
    seriesProjects,
    periodKeyFor
  );
  return { hasProjects: seriesProjects.length > 0, ...report };
}

function isLeader(req: AuthRequest) {
  const r = req.user?.role?.name;
  return r === "ADMIN" || r === "QA_LEAD";
}
function isClientPmRole(req: AuthRequest) {
  return req.user?.role?.name === "CLIENT_PM";
}
function isAnalystRole(req: AuthRequest) {
  return req.user?.role?.name === "QA_ANALYST";
}

router.get("/client/:id/monthly", async (req: AuthRequest, res: Response) => {
  if (!isLeader(req) && !isClientPmRole(req) && !isAnalystRole(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const parse = z
    .object({ months: z.coerce.number().int().min(1).max(24).default(6) })
    .safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const monthsCount = parse.data.months;

  const clientIdParam = req.params.id as string;
  const projectsFilter: any = isClientPmRole(req)
    ? { where: { projectManagerId: req.user!.id }, include: { testers: { select: { id: true, name: true, projectId: true } } } }
    : isAnalystRole(req)
    ? { where: { testers: { some: { userId: req.user!.id } } }, include: { testers: { select: { id: true, name: true, projectId: true } } } }
    : { include: { testers: { select: { id: true, name: true, projectId: true } } } };
  const client = await prisma.client.findUnique({
    where: { id: clientIdParam },
    include: { projects: projectsFilter },
  }) as any;
  if (!client) {
    res.status(404).json({ error: "client not found" });
    return;
  }
  if ((isClientPmRole(req) || isAnalystRole(req)) && client.projects.length === 0) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const today = new Date();
  const buckets: { start: Date; end: Date; label: string; key: string }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const ref = addMonths(today, -i);
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    buckets.push({
      start,
      end,
      label: format(start, "LLLL", { locale: es }).replace(/^./, (c) =>
        c.toUpperCase()
      ),
      key: format(start, "yyyy-MM"),
    });
  }

  const projectIds = client.projects.map((p: any) => p.id);
  const testerIds = client.projects.flatMap((p: any) => p.testers.map((t: any) => t.id));

  const records =
    testerIds.length > 0
      ? await prisma.dailyRecord.findMany({
          where: {
            testerId: { in: testerIds },
            date: {
              gte: buckets[0]!.start,
              lte: buckets[buckets.length - 1]!.end,
            },
          },
          select: {
            date: true,
            designed: true,
            executed: true,
            defects: true,
            testerId: true,
          },
        })
      : [];

  const testerProject = new Map<string, string>();
  for (const p of client.projects as any[])
    for (const t of p.testers as any[]) testerProject.set(t.id, p.id);

  type Agg = {
    designed: number;
    executed: number;
    defects: number;
    testers: Set<string>;
  };
  const makeAgg = (): Agg => ({
    designed: 0,
    executed: 0,
    defects: 0,
    testers: new Set(),
  });

  const totalByMonth: Record<string, Agg> = Object.fromEntries(
    buckets.map((b) => [b.key, makeAgg()])
  );
  const byProjectMonth: Record<string, Record<string, Agg>> =
    Object.fromEntries(
      projectIds.map((pid: string) => [
        pid,
        Object.fromEntries(buckets.map((b) => [b.key, makeAgg()])),
      ])
    );

  for (const r of records) {
    const monthKey = format(r.date, "yyyy-MM");
    if (!totalByMonth[monthKey]) continue;
    const pid = testerProject.get(r.testerId);
    if (!pid) continue;
    totalByMonth[monthKey]!.designed += r.designed;
    totalByMonth[monthKey]!.executed += r.executed;
    totalByMonth[monthKey]!.defects += r.defects;
    totalByMonth[monthKey]!.testers.add(r.testerId);
    byProjectMonth[pid]![monthKey]!.designed += r.designed;
    byProjectMonth[pid]![monthKey]!.executed += r.executed;
    byProjectMonth[pid]![monthKey]!.defects += r.defects;
    byProjectMonth[pid]![monthKey]!.testers.add(r.testerId);
  }

  const months = buckets.map((b) => b.label);
  const totalValues = (field: "designed" | "executed" | "defects") =>
    buckets.map((b) => totalByMonth[b.key]![field]);

  const avgValues = (field: "designed" | "executed") =>
    buckets.map((b) => {
      const a = totalByMonth[b.key]!;
      return a.testers.size > 0 ? Math.round(a[field] / a.testers.size) : 0;
    });

  const manualProjects = (client.projects as ReportProject[]).filter((p) => p.modality !== "AUTOMATION");
  const byProjectSeries = (field: "designed" | "executed" | "defects") =>
    manualProjects.map((p: any) => ({
      project: p.name,
      values: buckets.map((b) => byProjectMonth[p.id]![b.key]![field]),
    }));

  const automation = await automationSection(
    client.projects,
    { start: buckets[0]!.start, end: buckets[buckets.length - 1]!.end },
    buckets.map((b) => b.key),
    (d) => format(d, "yyyy-MM")
  );

  res.json({
    client: { id: client.id, name: client.name },
    months,
    labels: months,
    hasManual: manualProjects.length > 0,
    automation,
    designedTotal: { months, labels: months, values: totalValues("designed") },
    designedByProject: byProjectSeries("designed"),
    designedAverage: { months, labels: months, values: avgValues("designed") },
    executedTotal: { months, labels: months, values: totalValues("executed") },
    executedByProject: byProjectSeries("executed"),
    executedAverage: { months, labels: months, values: avgValues("executed") },
    defectsTotal: { months, labels: months, values: totalValues("defects") },
    defectsByProject: byProjectSeries("defects"),
    analysts: client.projects.map((p: any) => ({
      project: p.name,
      testers: p.testers.map((t: any) => t.name),
    })),
  });
});

router.get("/client/:id/weekly", async (req: AuthRequest, res: Response) => {
  if (!isLeader(req) && !isClientPmRole(req) && !isAnalystRole(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const parse = z
    .object({ weeks: z.coerce.number().int().min(1).max(52).default(8) })
    .safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const weeksCount = parse.data.weeks;

  const clientIdParam = req.params.id as string;
  const projectsFilter: any = isClientPmRole(req)
    ? { where: { projectManagerId: req.user!.id }, include: { testers: { select: { id: true, name: true, projectId: true } } } }
    : isAnalystRole(req)
    ? { where: { testers: { some: { userId: req.user!.id } } }, include: { testers: { select: { id: true, name: true, projectId: true } } } }
    : { include: { testers: { select: { id: true, name: true, projectId: true } } } };
  const client = await prisma.client.findUnique({
    where: { id: clientIdParam },
    include: { projects: projectsFilter },
  }) as any;
  if (!client) {
    res.status(404).json({ error: "client not found" });
    return;
  }
  if ((isClientPmRole(req) || isAnalystRole(req)) && client.projects.length === 0) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const today = new Date();
  const buckets: { start: Date; end: Date; label: string; key: string }[] = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const ref = addWeeks(today, -i);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    buckets.push({
      start,
      end,
      label: format(start, "d MMM", { locale: es }),
      key: format(start, "yyyy-'W'II"),
    });
  }

  const projectIds = client.projects.map((p: any) => p.id);
  const testerIds = client.projects.flatMap((p: any) => p.testers.map((t: any) => t.id));

  const records =
    testerIds.length > 0
      ? await prisma.dailyRecord.findMany({
          where: {
            testerId: { in: testerIds },
            date: {
              gte: buckets[0]!.start,
              lte: buckets[buckets.length - 1]!.end,
            },
          },
          select: {
            date: true,
            designed: true,
            executed: true,
            defects: true,
            testerId: true,
          },
        })
      : [];

  const testerProject = new Map<string, string>();
  for (const p of client.projects as any[])
    for (const t of p.testers as any[]) testerProject.set(t.id, p.id);

  type Agg = {
    designed: number;
    executed: number;
    defects: number;
    testers: Set<string>;
  };
  const makeAgg = (): Agg => ({
    designed: 0,
    executed: 0,
    defects: 0,
    testers: new Set(),
  });

  const totalByWeek: Record<string, Agg> = Object.fromEntries(
    buckets.map((b) => [b.key, makeAgg()])
  );
  const byProjectWeek: Record<string, Record<string, Agg>> =
    Object.fromEntries(
      projectIds.map((pid: string) => [
        pid,
        Object.fromEntries(buckets.map((b) => [b.key, makeAgg()])),
      ])
    );

  const weekKeyFor = (d: Date) =>
    format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II");

  for (const r of records) {
    const weekKey = weekKeyFor(r.date);
    if (!totalByWeek[weekKey]) continue;
    const pid = testerProject.get(r.testerId);
    if (!pid) continue;
    totalByWeek[weekKey]!.designed += r.designed;
    totalByWeek[weekKey]!.executed += r.executed;
    totalByWeek[weekKey]!.defects += r.defects;
    totalByWeek[weekKey]!.testers.add(r.testerId);
    byProjectWeek[pid]![weekKey]!.designed += r.designed;
    byProjectWeek[pid]![weekKey]!.executed += r.executed;
    byProjectWeek[pid]![weekKey]!.defects += r.defects;
    byProjectWeek[pid]![weekKey]!.testers.add(r.testerId);
  }

  const weeks = buckets.map((b) => b.label);
  const totalValues = (field: "designed" | "executed" | "defects") =>
    buckets.map((b) => totalByWeek[b.key]![field]);

  const avgValues = (field: "designed" | "executed") =>
    buckets.map((b) => {
      const a = totalByWeek[b.key]!;
      return a.testers.size > 0 ? Math.round(a[field] / a.testers.size) : 0;
    });

  const manualProjects = (client.projects as ReportProject[]).filter((p) => p.modality !== "AUTOMATION");
  const byProjectSeries = (field: "designed" | "executed" | "defects") =>
    manualProjects.map((p: any) => ({
      project: p.name,
      values: buckets.map((b) => byProjectWeek[p.id]![b.key]![field]),
    }));

  const automation = await automationSection(
    client.projects,
    { start: buckets[0]!.start, end: buckets[buckets.length - 1]!.end },
    buckets.map((b) => b.key),
    weekKeyFor
  );

  res.json({
    client: { id: client.id, name: client.name },
    weeks,
    labels: weeks,
    hasManual: manualProjects.length > 0,
    automation,
    designedTotal: { weeks, labels: weeks, values: totalValues("designed") },
    designedByProject: byProjectSeries("designed"),
    designedAverage: { weeks, labels: weeks, values: avgValues("designed") },
    executedTotal: { weeks, labels: weeks, values: totalValues("executed") },
    executedByProject: byProjectSeries("executed"),
    executedAverage: { weeks, labels: weeks, values: avgValues("executed") },
    defectsTotal: { weeks, labels: weeks, values: totalValues("defects") },
    defectsByProject: byProjectSeries("defects"),
    analysts: client.projects.map((p: any) => ({
      project: p.name,
      testers: p.testers.map((t: any) => t.name),
    })),
  });
});

export default router;
