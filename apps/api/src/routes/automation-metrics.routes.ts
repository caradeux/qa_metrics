import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import {
  aggregateAutomationDailyToWeekly,
  passRate,
  type AutomationDailyLike,
} from "../services/automation-metrics.service.js";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  const where: any = { id: projectId };
  if (isAnalyst(req)) where.testers = { some: { userId: req.user!.id } };
  else where.client = { userId: req.user!.id };
  const project = await prisma.project.findFirst({ where, select: { id: true } });
  return !!project;
}

// GET /?projectId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Métricas semanales de automatización del proyecto (scripts + ejecuciones + pass-rate).
router.get("/", requirePermission("test-lines", "read") as any, async (req: AuthRequest, res: Response) => {
  const parsed = z
    .object({
      projectId: z.string().min(1),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "parámetros inválidos", details: parsed.error.flatten() });
    return;
  }
  const { projectId, from, to } = parsed.data;
  if (!(await userCanAccessProject(req, projectId))) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  const records = await prisma.automationRecord.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      assignment: { testLine: { projectId } },
    },
    select: {
      date: true,
      scriptsCreated: true,
      scriptsRefactored: true,
      scriptsFixed: true,
      execTotal: true,
      execPassed: true,
      execFailed: true,
    },
  });

  const daily: AutomationDailyLike[] = records.map((r) => ({
    date: r.date,
    scriptsCreated: r.scriptsCreated,
    scriptsRefactored: r.scriptsRefactored,
    scriptsFixed: r.scriptsFixed,
    execTotal: r.execTotal,
    execPassed: r.execPassed,
    execFailed: r.execFailed,
  }));

  const buckets = aggregateAutomationDailyToWeekly(daily);
  const weeks = buckets.map((b) => ({
    weekStart: b.weekStart.toISOString().slice(0, 10),
    scriptsCreated: b.scriptsCreated,
    scriptsRefactored: b.scriptsRefactored,
    scriptsFixed: b.scriptsFixed,
    execTotal: b.execTotal,
    execPassed: b.execPassed,
    execFailed: b.execFailed,
    passRatePct: Math.round(passRate(b) * 100),
  }));

  const totals = daily.reduce(
    (acc, d) => {
      acc.scriptsCreated += d.scriptsCreated;
      acc.scriptsRefactored += d.scriptsRefactored;
      acc.scriptsFixed += d.scriptsFixed;
      acc.execTotal += d.execTotal;
      acc.execPassed += d.execPassed;
      acc.execFailed += d.execFailed;
      return acc;
    },
    { scriptsCreated: 0, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0 }
  );

  res.json({
    weeks,
    totals,
    passRatePct: Math.round(passRate(totals) * 100),
  });
});

export default router;
