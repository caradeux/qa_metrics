import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  calculateKPIs,
  aggregateWeeklyTrend,
  aggregateCaseTypes,
  aggregateDefects,
  aggregateTesterSummary,
} from "@qa-metrics/utils";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

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

      // Build where clause
      const where: Record<string, unknown> = {
        tester: { projectId },
      };
      if (cycleId) where.cycleId = cycleId;
      if (testerId) where.testerId = testerId;
      if (weekFrom || weekTo) {
        const weekRange: Record<string, Date> = {};
        if (weekFrom) weekRange.gte = new Date(weekFrom as string);
        if (weekTo) weekRange.lte = new Date(weekTo as string);
        where.weekStart = weekRange;
      }

      const records = await prisma.weeklyRecord.findMany({
        where,
        include: {
          tester: { select: { name: true } },
          cycle: { select: { name: true } },
        },
        orderBy: { weekStart: "asc" },
      });

      const kpis = calculateKPIs(records);
      const weeklyTrend = aggregateWeeklyTrend(records);
      const caseTypeDistribution = aggregateCaseTypes(records);
      const defectsBySeverity = aggregateDefects(records);
      const testerSummary = aggregateTesterSummary(records);

      // Complexity distribution from UserStories
      const storyWhere: Record<string, unknown> = {
        cycle: { projectId },
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

      // Cycle comparison — group records by cycleId to avoid N+1
      const projectIdStr = projectId as string;

      const allCycles = await prisma.testCycle.findMany({
        where: { projectId: projectIdStr },
        select: { id: true, name: true },
      });

      // Fetch all records for this project at once (no additional filters for cycle comparison)
      const allProjectRecords = await prisma.weeklyRecord.findMany({
        where: { tester: { projectId: projectIdStr } },
      });

      // Group by cycleId
      const recordsByCycle = new Map<string, typeof allProjectRecords>();
      for (const r of allProjectRecords) {
        const arr = recordsByCycle.get(r.cycleId) || [];
        arr.push(r);
        recordsByCycle.set(r.cycleId, arr);
      }

      const cycleComparison = allCycles.map((cycle) => {
        const cycleRecords = recordsByCycle.get(cycle.id) || [];
        const stats = calculateKPIs(cycleRecords);
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
          const records = await prisma.weeklyRecord.findMany({
            where: { tester: { projectId: project.id } },
          });

          const totalDesigned = records.reduce(
            (s, r) => s + r.designedTotal,
            0
          );
          const totalExecuted = records.reduce(
            (s, r) => s + r.executedTotal,
            0
          );
          const totalDefects = records.reduce(
            (s, r) =>
              s +
              r.defectsCritical +
              r.defectsHigh +
              r.defectsMedium +
              r.defectsLow,
            0
          );
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

          const defectsBySeverity = {
            critical: records.reduce((s, r) => s + r.defectsCritical, 0),
            high: records.reduce((s, r) => s + r.defectsHigh, 0),
            medium: records.reduce((s, r) => s + r.defectsMedium, 0),
            low: records.reduce((s, r) => s + r.defectsLow, 0),
          };

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
            weekCount: new Set(
              records.map((r) => r.weekStart.toISOString())
            ).size,
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
        totalDefects: projectMetrics.reduce(
          (s, p) => s + p.totalDefects,
          0
        ),
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

export default router;
