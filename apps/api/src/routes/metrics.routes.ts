import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import { aggregateDailyToWeekly } from "../services/metrics.service.js";
import { addDays } from "date-fns";
import { z } from "zod";

const router = Router();
router.use(authMiddleware as any);

interface DailyRow {
  testerId: string;
  cycleId: string;
  date: Date;
  designed: number;
  executed: number;
  defects: number;
  tester?: { name: string };
}

interface BreakdownRow {
  designedFunctional: number;
  designedRegression: number;
  designedSmoke: number;
  designedExploratory: number;
  executedFunctional: number;
  executedRegression: number;
  executedSmoke: number;
  executedExploratory: number;
  defectsCritical: number;
  defectsHigh: number;
  defectsMedium: number;
  defectsLow: number;
}

function emptyBreakdown(): BreakdownRow {
  return {
    designedFunctional: 0,
    designedRegression: 0,
    designedSmoke: 0,
    designedExploratory: 0,
    executedFunctional: 0,
    executedRegression: 0,
    executedSmoke: 0,
    executedExploratory: 0,
    defectsCritical: 0,
    defectsHigh: 0,
    defectsMedium: 0,
    defectsLow: 0,
  };
}

function sumBreakdowns(list: BreakdownRow[]): BreakdownRow {
  return list.reduce<BreakdownRow>((acc, b) => {
    acc.designedFunctional += b.designedFunctional;
    acc.designedRegression += b.designedRegression;
    acc.designedSmoke += b.designedSmoke;
    acc.designedExploratory += b.designedExploratory;
    acc.executedFunctional += b.executedFunctional;
    acc.executedRegression += b.executedRegression;
    acc.executedSmoke += b.executedSmoke;
    acc.executedExploratory += b.executedExploratory;
    acc.defectsCritical += b.defectsCritical;
    acc.defectsHigh += b.defectsHigh;
    acc.defectsMedium += b.defectsMedium;
    acc.defectsLow += b.defectsLow;
    return acc;
  }, emptyBreakdown());
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

      const where: Record<string, unknown> = {
        tester: { projectId },
      };
      if (cycleId) where.cycleId = cycleId;
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

      // Breakdowns — por ciclo filtrado
      const projectIdStr = projectId as string;
      const breakdownWhere: Record<string, unknown> = cycleId
        ? { cycleId }
        : { cycle: { projectId: projectIdStr } };
      const breakdowns = (await prisma.cycleBreakdown.findMany({
        where: breakdownWhere,
      })) as unknown as BreakdownRow[];
      const summed = sumBreakdowns(breakdowns);

      const caseTypeDistribution = {
        functional: {
          designed: summed.designedFunctional,
          executed: summed.executedFunctional,
        },
        regression: {
          designed: summed.designedRegression,
          executed: summed.executedRegression,
        },
        smoke: {
          designed: summed.designedSmoke,
          executed: summed.executedSmoke,
        },
        exploratory: {
          designed: summed.designedExploratory,
          executed: summed.executedExploratory,
        },
      };
      const defectsBySeverity = {
        critical: summed.defectsCritical,
        high: summed.defectsHigh,
        medium: summed.defectsMedium,
        low: summed.defectsLow,
      };

      // Complexity distribution from UserStories
      const storyWhere: Record<string, unknown> = {
        cycle: { projectId: projectIdStr },
      };
      if (cycleId) storyWhere.cycleId = cycleId;

      const stories = await prisma.userStory.groupBy({
        by: ["complexity"],
        where: storyWhere,
        _count: true,
      });

      const complexityDistribution = {
        high: stories.find((s) => s.complexity === "HIGH")?._count ?? 0,
        medium: stories.find((s) => s.complexity === "MEDIUM")?._count ?? 0,
        low: stories.find((s) => s.complexity === "LOW")?._count ?? 0,
      };

      // Cycle comparison — KPIs por ciclo (todos los del proyecto)
      const allCycles = await prisma.testCycle.findMany({
        where: { projectId: projectIdStr },
        select: { id: true, name: true },
      });
      const allProjectRecords = (await prisma.dailyRecord.findMany({
        where: { tester: { projectId: projectIdStr } },
        select: {
          cycleId: true,
          designed: true,
          executed: true,
          defects: true,
          testerId: true,
          date: true,
        },
      })) as unknown as DailyRow[];

      const recordsByCycle = new Map<string, DailyRow[]>();
      for (const r of allProjectRecords) {
        const arr = recordsByCycle.get(r.cycleId) ?? [];
        arr.push(r);
        recordsByCycle.set(r.cycleId, arr);
      }

      const cycleComparison = allCycles.map((cycle) => {
        const cycleRecords = recordsByCycle.get(cycle.id) ?? [];
        const stats = kpisFromDaily(cycleRecords);
        return { cycleName: cycle.name, ...stats };
      });

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

      const projects = await prisma.project.findMany({
        where: { clientId: clientId as string },
        select: { id: true, name: true, modality: true },
      });

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
            where: { projectId: project.id },
          });

          const breakdowns = (await prisma.cycleBreakdown.findMany({
            where: { cycle: { projectId: project.id } },
          })) as unknown as BreakdownRow[];
          const summed = sumBreakdowns(breakdowns);
          const defectsBySeverity = {
            critical: summed.defectsCritical,
            high: summed.defectsHigh,
            medium: summed.defectsMedium,
            low: summed.defectsLow,
          };

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

      const totals = {
        totalDesigned: projectMetrics.reduce(
          (s, p) => s + p.totalDesigned,
          0
        ),
        totalExecuted: projectMetrics.reduce(
          (s, p) => s + p.totalExecuted,
          0
        ),
        totalDefects: projectMetrics.reduce((s, p) => s + p.totalDefects, 0),
        ratio: 0,
        projectCount: projectMetrics.length,
        testerCount: projectMetrics.reduce((s, p) => s + p.testerCount, 0),
        defectsBySeverity: {
          critical: projectMetrics.reduce(
            (s, p) => s + p.defectsBySeverity.critical,
            0
          ),
          high: projectMetrics.reduce(
            (s, p) => s + p.defectsBySeverity.high,
            0
          ),
          medium: projectMetrics.reduce(
            (s, p) => s + p.defectsBySeverity.medium,
            0
          ),
          low: projectMetrics.reduce(
            (s, p) => s + p.defectsBySeverity.low,
            0
          ),
        },
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
