import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import { aggregateDailyToWeekly } from "../services/metrics.service.js";
import { isClientPm, isAnalyst } from "../lib/access.js";
import { addDays } from "date-fns";
import { z } from "zod";

const router = Router();
router.use(authMiddleware as any);

interface DailyRow {
  testerId: string;
  date: Date;
  designed: number;
  executed: number;
  defects: number;
  tester?: { name: string };
}

function kpisFromDaily(records: DailyRow[]) {
  const totalDesigned = records.reduce((s, r) => s + r.designed, 0);
  const totalExecuted = records.reduce((s, r) => s + r.executed, 0);
  const totalDefects = records.reduce((s, r) => s + r.defects, 0);
  const executionRatio =
    totalDesigned > 0
      ? Math.round((totalExecuted / totalDesigned) * 100)
      : 0;
  return { totalDesigned, totalExecuted, totalDefects, executionRatio };
}

function testerSummaryFromDaily(records: DailyRow[]) {
  const grouped = new Map<
    string,
    {
      testerId: string;
      testerName: string;
      designed: number;
      executed: number;
      defects: number;
    }
  >();
  for (const r of records) {
    const cur = grouped.get(r.testerId) ?? {
      testerId: r.testerId,
      testerName: r.tester?.name ?? "Unknown",
      designed: 0,
      executed: 0,
      defects: 0,
    };
    cur.designed += r.designed;
    cur.executed += r.executed;
    cur.defects += r.defects;
    grouped.set(r.testerId, cur);
  }
  return [...grouped.values()].map((t) => ({
    ...t,
    ratio: t.designed > 0 ? Math.round((t.executed / t.designed) * 100) : 0,
  }));
}

// GET / — Project metrics
router.get(
  "/",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, cycleId, weekFrom, weekTo, testerId } = req.query;

      if (!projectId) {
        res.status(400).json({ error: "projectId es obligatorio" });
        return;
      }

      if (isClientPm(req)) {
        const owned = await prisma.project.findFirst({
          where: { id: projectId as string, projectManagerId: req.user!.id },
          select: { id: true },
        });
        if (!owned) {
          res.status(403).json({ error: "Sin acceso a este proyecto" });
          return;
        }
      } else if (isAnalyst(req)) {
        const linked = await prisma.project.findFirst({
          where: { id: projectId as string, testers: { some: { userId: req.user!.id } } },
          select: { id: true },
        });
        if (!linked) {
          res.status(403).json({ error: "Sin acceso a este proyecto" });
          return;
        }
      }

      const where: Record<string, unknown> = {
        tester: { projectId },
      };
      if (testerId) where.testerId = testerId;
      if (weekFrom || weekTo) {
        const dateRange: Record<string, Date> = {};
        if (weekFrom) dateRange.gte = new Date(weekFrom as string);
        if (weekTo) dateRange.lte = new Date(weekTo as string);
        where.date = dateRange;
      }

      const records = (await prisma.dailyRecord.findMany({
        where,
        include: {
          tester: { select: { name: true } },
        },
        orderBy: { date: "asc" },
      })) as unknown as DailyRow[];

      const kpis = kpisFromDaily(records);

      const weekBuckets = aggregateDailyToWeekly(
        records.map((r) => ({
          date: r.date,
          designed: r.designed,
          executed: r.executed,
          defects: r.defects,
        }))
      );
      const weeklyTrend = weekBuckets.map((b) => ({
        weekStart: b.weekStart.toISOString().split("T")[0],
        designed: b.designed,
        executed: b.executed,
        defects: b.defects,
      }));

      const testerSummary = testerSummaryFromDaily(records);

      // TODO: Case types y severity ahora requieren tracking por HU/ciclo — pendiente rediseno.
      const caseTypeDistribution = {
        functional: { designed: 0, executed: 0 },
        regression: { designed: 0, executed: 0 },
        smoke: { designed: 0, executed: 0 },
        exploratory: { designed: 0, executed: 0 },
      };
      const defectsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

      // Complexity distribution from UserStories
      const projectIdStr = projectId as string;
      const storyWhere: Record<string, unknown> = { projectId: projectIdStr };
      if (cycleId) {
        // Filter stories that have at least one assignment in that cycle
        storyWhere.assignments = { some: { cycleId } };
      }

      const stories = await prisma.userStory.groupBy({
        by: ["executionComplexity"],
        where: storyWhere,
        _count: true,
      });

      const complexityDistribution = {
        high: stories.find((s) => s.executionComplexity === "HIGH")?._count ?? 0,
        medium: stories.find((s) => s.executionComplexity === "MEDIUM")?._count ?? 0,
        low: stories.find((s) => s.executionComplexity === "LOW")?._count ?? 0,
      };

      // Cycle comparison — KPIs por ciclo (de todas las stories del proyecto)
      // Los cycles ya no estan ligados al proyecto directamente; se obtienen via stories.
      const allCycles = await prisma.testCycle.findMany({
        where: { story: { projectId: projectIdStr } },
        select: { id: true, name: true },
      });
      // DailyRecord ya no tiene cycleId, por lo que la comparacion por ciclo con
      // datos de ejecucion diaria no es calculable sin una pasada por assignments.
      // TODO: redisenar cycleComparison basandonos en assignments. Por ahora vacio.
      const cycleComparison = allCycles.map((c) => ({
        cycleName: c.name,
        totalDesigned: 0,
        totalExecuted: 0,
        totalDefects: 0,
        executionRatio: 0,
      }));

      res.json({
        kpis,
        weeklyTrend,
        caseTypeDistribution,
        defectsBySeverity,
        complexityDistribution,
        testerSummary,
        cycleComparison,
      });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener metricas" });
    }
  }
);

// GET /client — Client metrics
router.get(
  "/client",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { clientId } = req.query;

      if (!clientId) {
        res.status(400).json({ error: "clientId es obligatorio" });
        return;
      }

      const client = await prisma.client.findUnique({
        where: { id: clientId as string },
        select: { id: true, name: true },
      });
      if (!client) {
        res.status(404).json({ error: "Cliente no encontrado" });
        return;
      }

      const projectsWhere: any = { clientId: clientId as string };
      if (isClientPm(req)) projectsWhere.projectManagerId = req.user!.id;
      else if (isAnalyst(req)) projectsWhere.testers = { some: { userId: req.user!.id } };
      const projects = await prisma.project.findMany({
        where: projectsWhere,
        select: { id: true, name: true, modality: true },
      });

      if ((isClientPm(req) || isAnalyst(req)) && projects.length === 0) {
        res.status(403).json({ error: "Sin acceso a este cliente" });
        return;
      }

      const projectMetrics = await Promise.all(
        projects.map(async (project) => {
          const records = (await prisma.dailyRecord.findMany({
            where: { tester: { projectId: project.id } },
            select: {
              designed: true,
              executed: true,
              defects: true,
              date: true,
            },
          })) as Array<{
            designed: number;
            executed: number;
            defects: number;
            date: Date;
          }>;

          const totalDesigned = records.reduce((s, r) => s + r.designed, 0);
          const totalExecuted = records.reduce((s, r) => s + r.executed, 0);
          const totalDefects = records.reduce((s, r) => s + r.defects, 0);
          const ratio =
            totalDesigned > 0
              ? Math.round((totalExecuted / totalDesigned) * 100)
              : 0;

          const testerCount = await prisma.tester.count({
            where: { projectId: project.id },
          });
          const cycleCount = await prisma.testCycle.count({
            where: { story: { projectId: project.id } },
          });

          // TODO: severity breakdown pendiente de redisenarlo sin CycleBreakdown
          const defectsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

          const weekBuckets = aggregateDailyToWeekly(records);

          return {
            id: project.id,
            name: project.name,
            modality: project.modality,
            totalDesigned,
            totalExecuted,
            totalDefects,
            ratio,
            testerCount,
            cycleCount,
            defectsBySeverity,
            weekCount: weekBuckets.length,
          };
        })
      );

      // Tasa de rechazo + Lead time entre ciclos (tiempo que Dev tarda en entregar correcciones)
      const projectIds = projects.map((p) => p.id);
      const assignments = await prisma.testerAssignment.findMany({
        where: { story: { projectId: { in: projectIds } } },
        select: {
          id: true,
          status: true,
          storyId: true,
          cycleId: true,
          startDate: true,
          endDate: true,
          cycle: { select: { id: true, name: true, startDate: true } },
          statusLogs: { select: { status: true, changedAt: true }, orderBy: { changedAt: "asc" } },
        },
      });
      const totalAssignments = assignments.length;
      const rejected = assignments.filter((a) => a.status === "RETURNED_TO_DEV").length;
      const rejectionRate = totalAssignments > 0 ? Math.round((rejected / totalAssignments) * 100) : 0;

      // Lead time entre ciclos: por cada HU, ordenar sus asignaciones por ciclo (startDate del ciclo).
      // Para cada par consecutivo, calcular: (startDate del siguiente ciclo) - (fin del ciclo previo),
      // donde fin del ciclo previo = endDate de la asignación o, si está abierta, última entrada a RETURNED_TO_DEV.
      const byStory = new Map<string, typeof assignments>();
      for (const a of assignments) {
        if (!byStory.has(a.storyId)) byStory.set(a.storyId, []);
        byStory.get(a.storyId)!.push(a);
      }
      const gaps: number[] = [];
      for (const storyAssignments of byStory.values()) {
        const sorted = [...storyAssignments].sort((a, b) => {
          const da = a.cycle?.startDate ? new Date(a.cycle.startDate).getTime() : new Date(a.startDate).getTime();
          const db = b.cycle?.startDate ? new Date(b.cycle.startDate).getTime() : new Date(b.startDate).getTime();
          return da - db;
        });
        for (let i = 0; i < sorted.length - 1; i++) {
          const prev = sorted[i]!;
          const next = sorted[i + 1]!;
          // Fin de la asignación previa
          let prevEnd: number | null = prev.endDate ? new Date(prev.endDate).getTime() : null;
          if (!prevEnd) {
            // Usar última entrada a RETURNED_TO_DEV en sus logs
            const returned = [...prev.statusLogs].reverse().find((l) => l.status === "RETURNED_TO_DEV");
            if (returned) prevEnd = new Date(returned.changedAt).getTime();
          }
          const nextStart = next.cycle?.startDate
            ? new Date(next.cycle.startDate).getTime()
            : new Date(next.startDate).getTime();
          if (prevEnd !== null && nextStart > prevEnd) {
            gaps.push(nextStart - prevEnd);
          }
        }
      }
      const devDeliveryLeadTime = gaps.length > 0
        ? Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) / (1000 * 60 * 60 * 24) * 10) / 10
        : 0;

      // Además mantenemos el desglose de tiempo en cada estado como antes
      const now = Date.now();
      const statusDurations: Record<string, { totalMs: number; count: number }> = {};
      for (const a of assignments) {
        const logs = a.statusLogs.length > 0
          ? a.statusLogs
          : [{ status: a.status, changedAt: a.startDate }];
        for (let i = 0; i < logs.length; i++) {
          const curr = logs[i]!;
          const next = logs[i + 1];
          const start = new Date(curr.changedAt).getTime();
          const end = next ? new Date(next.changedAt).getTime() : now;
          const ms = Math.max(0, end - start);
          const k = curr.status;
          if (!statusDurations[k]) statusDurations[k] = { totalMs: 0, count: 0 };
          statusDurations[k].totalMs += ms;
          statusDurations[k].count += 1;
        }
      }
      const leadTime: Record<string, number> = {};
      for (const [status, { totalMs, count }] of Object.entries(statusDurations)) {
        leadTime[status] = count > 0 ? Math.round(totalMs / count / (1000 * 60 * 60 * 24) * 10) / 10 : 0;
      }

      const totals = {
        totalDesigned: projectMetrics.reduce((s, p) => s + p.totalDesigned, 0),
        totalExecuted: projectMetrics.reduce((s, p) => s + p.totalExecuted, 0),
        totalDefects: projectMetrics.reduce((s, p) => s + p.totalDefects, 0),
        ratio: 0,
        rejectionRate,
        totalAssignments,
        rejectedAssignments: rejected,
        devDeliveryLeadTime, // días promedio entre ciclo N y ciclo N+1 (tiempo que dev tarda en entregar correcciones)
        devDeliverySamples: gaps.length,
        leadTime, // { REGISTERED: N, ANALYSIS: N, ..., WAITING_UAT: N, ... } en días promedio
        projectCount: projectMetrics.length,
        testerCount: projectMetrics.reduce((s, p) => s + p.testerCount, 0),
        defectsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      };
      totals.ratio =
        totals.totalDesigned > 0
          ? Math.round((totals.totalExecuted / totals.totalDesigned) * 100)
          : 0;

      res.json({ client, totals, projects: projectMetrics });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener metricas del cliente" });
    }
  }
);

// GET /projects/:id/lead-time — lead time por HU (desde primera asignación hasta PRODUCTION)
router.get(
  "/projects/:id/lead-time",
  async (req: AuthRequest, res: Response) => {
    const projectId = req.params.id as string;

    const stories = await prisma.userStory.findMany({
      where: { projectId },
      select: {
        id: true,
        externalId: true,
        title: true,
        assignments: {
          select: {
            createdAt: true,
            statusLogs: {
              select: { status: true, changedAt: true },
              orderBy: { changedAt: "asc" },
            },
          },
        },
      },
    });

    const now = Date.now();
    const DAY = 86400000;

    const items = stories.map((s) => {
      if (s.assignments.length === 0) {
        return {
          storyId: s.id,
          externalId: s.externalId,
          title: s.title,
          startDate: null as string | null,
          endDate: null as string | null,
          leadTimeDays: null as number | null,
          status: "NOT_STARTED" as const,
        };
      }

      const startMs = Math.min(
        ...s.assignments.map((a) => new Date(a.createdAt).getTime())
      );

      let prodMs: number | null = null;
      for (const a of s.assignments) {
        for (const log of a.statusLogs) {
          if (log.status === "PRODUCTION") {
            const t = new Date(log.changedAt).getTime();
            if (prodMs === null || t < prodMs) prodMs = t;
            break; // first PRODUCTION per assignment is enough
          }
        }
      }

      const endMs = prodMs ?? now;
      const leadTimeDays = Math.max(0, Math.floor((endMs - startMs) / DAY));

      return {
        storyId: s.id,
        externalId: s.externalId,
        title: s.title,
        startDate: new Date(startMs).toISOString(),
        endDate: prodMs ? new Date(prodMs).toISOString() : null,
        leadTimeDays,
        status: prodMs ? ("CLOSED" as const) : ("OPEN" as const),
      };
    });

    const closed = items.filter((i) => i.status === "CLOSED" && i.leadTimeDays !== null);
    const values = closed.map((i) => i.leadTimeDays as number).sort((a, b) => a - b);

    function percentile(p: number): number | null {
      if (values.length === 0) return null;
      const idx = Math.ceil((p / 100) * values.length) - 1;
      return values[Math.max(0, Math.min(values.length - 1, idx))] ?? null;
    }

    const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

    res.json({
      projectId,
      totals: {
        total: items.length,
        closed: closed.length,
        open: items.filter((i) => i.status === "OPEN").length,
        notStarted: items.filter((i) => i.status === "NOT_STARTED").length,
      },
      aggregates: {
        p50: percentile(50),
        p90: percentile(90),
        avg,
        min: values.length > 0 ? values[0] : null,
        max: values.length > 0 ? values[values.length - 1] : null,
      },
      stories: items.sort((a, b) => (b.leadTimeDays ?? -1) - (a.leadTimeDays ?? -1)),
    });
  }
);

// GET /projects/:id/daily-activity — Mon–Fri aggregated daily activity for a week
router.get(
  "/projects/:id/daily-activity",
  async (req: AuthRequest, res: Response) => {
    const projectId = req.params.id as string;
    const { weekStart } = req.query as { weekStart?: string };
    const parse = z
      .object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .safeParse({ weekStart });
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const monday = new Date(parse.data.weekStart + "T00:00:00");
    const friday = addDays(monday, 4);
    const records = await prisma.dailyRecord.findMany({
      where: {
        date: { gte: monday, lte: friday },
        tester: { projectId },
      },
      select: { date: true, designed: true, executed: true, defects: true },
    });

    const byDay = new Map<
      string,
      { designed: number; executed: number; defects: number }
    >();
    for (const r of records) {
      const key = r.date.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { designed: 0, executed: 0, defects: 0 };
      cur.designed += r.designed;
      cur.executed += r.executed;
      cur.defects += r.defects;
      byDay.set(key, cur);
    }
    const days: Array<{
      date: string;
      designed: number;
      executed: number;
      defects: number;
    }> = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(monday, i);
      const key = d.toISOString().slice(0, 10);
      const agg = byDay.get(key) ?? { designed: 0, executed: 0, defects: 0 };
      days.push({ date: key, ...agg });
    }
    res.json({ weekStart: parse.data.weekStart, days });
  }
);

export default router;
