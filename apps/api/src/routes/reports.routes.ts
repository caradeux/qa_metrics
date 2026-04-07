import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  calculateKPIs,
  aggregateWeeklyTrend,
  aggregateDefects,
  aggregateTesterSummary,
} from "@qa-metrics/utils";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import { generateExcelReport } from "../services/report-excel.js";
import { jsPDF } from "jspdf";

const router = Router();
router.use(authMiddleware as any);

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

      const where: Record<string, unknown> = {
        tester: { projectId },
      };
      if (cycleId) where.cycleId = cycleId;
      if (testerId) where.testerId = testerId;

      const records = await prisma.weeklyRecord.findMany({
        where,
        include: { tester: { select: { name: true } } },
        orderBy: { weekStart: "asc" },
      });

      const kpis = calculateKPIs(records);
      const weeklyTrend = aggregateWeeklyTrend(records);
      const defectsBySeverity = aggregateDefects(records);
      const testerSummary = aggregateTesterSummary(records);

      const allCycles = await prisma.testCycle.findMany({
        where: { projectId: projectId as string },
      });
      const cycleComparison = await Promise.all(
        allCycles.map(async (cycle) => {
          const cycleRecords = await prisma.weeklyRecord.findMany({
            where: { cycleId: cycle.id },
          });
          const stats = calculateKPIs(cycleRecords);
          return { cycleName: cycle.name, ...stats };
        })
      );

      const buffer = await generateExcelReport({
        projectName: project.name,
        clientName: project.client.name,
        kpis,
        weeklyTrend,
        testerSummary,
        cycleComparison,
        defectsBySeverity,
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

      const where: Record<string, unknown> = {
        tester: { projectId },
      };
      if (cycleId) where.cycleId = cycleId;
      if (testerId) where.testerId = testerId;

      const records = await prisma.weeklyRecord.findMany({
        where,
        include: { tester: { select: { name: true } } },
        orderBy: { weekStart: "asc" },
      });

      const kpis = calculateKPIs(records);
      const weeklyTrend = aggregateWeeklyTrend(records);
      const defects = aggregateDefects(records);
      const testerSummary = aggregateTesterSummary(records);

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.setTextColor(31, 56, 100);
      doc.text("Reporte de Metricas QA", 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Proyecto: ${project.name}`, 14, 30);
      doc.text(`Cliente: ${project.client.name}`, 14, 37);
      doc.text(`Fecha: ${new Date().toLocaleDateString("es")}`, 14, 44);

      // KPIs
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

      // Weekly Trend
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

      // Tester Summary
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

      // Defects by Severity
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
      doc.text(`Criticos: ${defects.critical}`, 14, y);
      y += 7;
      doc.text(`Altos: ${defects.high}`, 14, y);
      y += 7;
      doc.text(`Medios: ${defects.medium}`, 14, y);
      y += 7;
      doc.text(`Bajos: ${defects.low}`, 14, y);

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
