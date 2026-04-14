import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import {
  generateExcelReport,
  type DailyDetailRow,
} from "../services/report-excel.js";
import { aggregateDailyToWeekly } from "../services/metrics.service.js";
import { jsPDF } from "jspdf";

const router = Router();
router.use(authMiddleware as any);

interface DailyRowWithRelations {
  testerId: string;
  cycleId: string;
  date: Date;
  designed: number;
  executed: number;
  defects: number;
  tester: { name: string };
  cycle: { name: string };
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

function kpisFromDaily(
  records: Array<{ designed: number; executed: number; defects: number }>
) {
  const totalDesigned = records.reduce((s, r) => s + r.designed, 0);
  const totalExecuted = records.reduce((s, r) => s + r.executed, 0);
  const totalDefects = records.reduce((s, r) => s + r.defects, 0);
  const executionRatio =
    totalDesigned > 0
      ? Math.round((totalExecuted / totalDesigned) * 100)
      : 0;
  return { totalDesigned, totalExecuted, totalDefects, executionRatio };
}

function testerSummaryFromDaily(records: DailyRowWithRelations[]) {
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

function defectsFromBreakdowns(list: BreakdownRow[]) {
  return list.reduce(
    (acc, b) => ({
      critical: acc.critical + b.defectsCritical,
      high: acc.high + b.defectsHigh,
      medium: acc.medium + b.defectsMedium,
      low: acc.low + b.defectsLow,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

async function loadReportData(
  projectId: string,
  cycleId?: string,
  testerId?: string
) {
  const where: Record<string, unknown> = { tester: { projectId } };
  if (cycleId) where.cycleId = cycleId;
  if (testerId) where.testerId = testerId;

  const records = (await prisma.dailyRecord.findMany({
    where,
    include: {
      tester: { select: { name: true } },
      cycle: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  })) as unknown as DailyRowWithRelations[];

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

  const breakdownWhere: Record<string, unknown> = cycleId
    ? { cycleId }
    : { cycle: { projectId } };
  const breakdowns = (await prisma.cycleBreakdown.findMany({
    where: breakdownWhere,
  })) as unknown as BreakdownRow[];
  const defectsBySeverity = defectsFromBreakdowns(breakdowns);

  const allCycles = await prisma.testCycle.findMany({
    where: { projectId },
    select: { id: true, name: true },
  });
  const allProjectRecords = await prisma.dailyRecord.findMany({
    where: { tester: { projectId } },
    select: {
      cycleId: true,
      designed: true,
      executed: true,
      defects: true,
    },
  });
  const byCycle = new Map<
    string,
    Array<{ designed: number; executed: number; defects: number }>
  >();
  for (const r of allProjectRecords) {
    const arr = byCycle.get(r.cycleId) ?? [];
    arr.push(r);
    byCycle.set(r.cycleId, arr);
  }
  const cycleComparison = allCycles.map((c) => ({
    cycleName: c.name,
    ...kpisFromDaily(byCycle.get(c.id) ?? []),
  }));

  const dailyDetail: DailyDetailRow[] = records.map((r) => ({
    date: r.date.toISOString().split("T")[0],
    testerName: r.tester?.name ?? "Unknown",
    cycleName: r.cycle?.name ?? "Unknown",
    designed: r.designed,
    executed: r.executed,
    defects: r.defects,
  }));

  return {
    kpis,
    weeklyTrend,
    testerSummary,
    defectsBySeverity,
    cycleComparison,
    dailyDetail,
  };
}

// GET /excel — Generate Excel report
router.get(
  "/excel",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, cycleId, testerId } = req.query;

      if (!projectId) {
        res.status(400).json({ error: "projectId es obligatorio" });
        return;
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId as string },
        include: { client: { select: { name: true } } },
      });

      if (!project) {
        res.status(404).json({ error: "Proyecto no encontrado" });
        return;
      }

      const data = await loadReportData(
        projectId as string,
        cycleId as string | undefined,
        testerId as string | undefined
      );

      const buffer = await generateExcelReport({
        projectName: project.name,
        clientName: project.client.name,
        kpis: data.kpis,
        weeklyTrend: data.weeklyTrend,
        testerSummary: data.testerSummary,
        cycleComparison: data.cycleComparison,
        defectsBySeverity: data.defectsBySeverity,
        dailyDetail: data.dailyDetail,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="reporte-${project.name}.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: "Error al generar el reporte Excel" });
    }
  }
);

// POST /pdf — Generate PDF report
router.post(
  "/pdf",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, cycleId, testerId } = req.body;

      if (!projectId) {
        res.status(400).json({ error: "projectId es obligatorio" });
        return;
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { client: { select: { name: true } } },
      });

      if (!project) {
        res.status(404).json({ error: "Proyecto no encontrado" });
        return;
      }

      const data = await loadReportData(projectId, cycleId, testerId);
      const { kpis, weeklyTrend, testerSummary, defectsBySeverity } = data;

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(31, 56, 100);
      doc.text("Reporte de Metricas QA", 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Proyecto: ${project.name}`, 14, 30);
      doc.text(`Cliente: ${project.client.name}`, 14, 37);
      doc.text(`Fecha: ${new Date().toLocaleDateString("es")}`, 14, 44);

      doc.setFontSize(14);
      doc.setTextColor(31, 56, 100);
      doc.text("Indicadores Clave (KPIs)", 14, 58);

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const kpiData = [
        ["Total Casos Disenados", String(kpis.totalDesigned)],
        ["Total Casos Ejecutados", String(kpis.totalExecuted)],
        ["Total Defectos", String(kpis.totalDefects)],
        ["Ratio Ejecucion/Diseno", `${kpis.executionRatio}%`],
      ];

      let y = 66;
      kpiData.forEach(([label, value]) => {
        doc.text(label, 14, y);
        doc.text(value, 100, y);
        y += 7;
      });

      y += 5;
      doc.setFontSize(14);
      doc.setTextColor(31, 56, 100);
      doc.text("Tendencia Semanal", 14, y);
      y += 10;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Semana", 14, y);
      doc.text("Dis.", 60, y);
      doc.text("Ejec.", 80, y);
      doc.text("Def.", 100, y);
      y += 6;

      doc.setTextColor(0, 0, 0);
      weeklyTrend.forEach((w) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(w.weekStart, 14, y);
        doc.text(String(w.designed), 60, y);
        doc.text(String(w.executed), 80, y);
        doc.text(String(w.defects), 100, y);
        y += 6;
      });

      y += 10;
      if (y > 230) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(31, 56, 100);
      doc.text("Resumen por Tester", 14, y);
      y += 10;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Tester", 14, y);
      doc.text("Dis.", 70, y);
      doc.text("Ejec.", 90, y);
      doc.text("Def.", 110, y);
      doc.text("Ratio", 130, y);
      y += 6;

      doc.setTextColor(0, 0, 0);
      testerSummary.forEach((t) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(t.testerName, 14, y);
        doc.text(String(t.designed), 70, y);
        doc.text(String(t.executed), 90, y);
        doc.text(String(t.defects), 110, y);
        doc.text(`${t.ratio}%`, 130, y);
        y += 6;
      });

      y += 10;
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(31, 56, 100);
      doc.text("Defectos por Severidad", 14, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Criticos: ${defectsBySeverity.critical}`, 14, y);
      y += 7;
      doc.text(`Altos: ${defectsBySeverity.high}`, 14, y);
      y += 7;
      doc.text(`Medios: ${defectsBySeverity.medium}`, 14, y);
      y += 7;
      doc.text(`Bajos: ${defectsBySeverity.low}`, 14, y);

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="reporte-${project.name}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({ error: "Error al generar el reporte PDF" });
    }
  }
);

export default router;
