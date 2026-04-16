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
import { buildWeeklyPptxBuffer, type WeeklyProjectSlide } from "../lib/weekly-pptx.js";
import {
  buildPipelineDonut,
  buildDesignedVsExecutedBars,
  buildDefectsBars,
  type PipelineDatum,
  type ProjectMetricsDatum,
} from "../lib/weekly-charts.js";
import { addDays, startOfWeek } from "date-fns";
import { isClientPm, isAnalyst, clientPmProjectIds, analystProjectIds } from "../lib/access.js";

const router = Router();
router.use(authMiddleware as any);

interface DailyRowWithRelations {
  testerId: string;
  date: Date;
  designed: number;
  executed: number;
  defects: number;
  tester: { name: string };
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

async function loadReportData(
  projectId: string,
  _cycleId?: string,
  testerId?: string
) {
  const where: Record<string, unknown> = { tester: { projectId } };
  if (testerId) where.testerId = testerId;

  const records = (await prisma.dailyRecord.findMany({
    where,
    include: {
      tester: { select: { name: true } },
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

  // TODO: defectsBySeverity pendiente de redisenarlo sin CycleBreakdown
  const defectsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

  const allCycles = await prisma.testCycle.findMany({
    where: { story: { projectId } },
    select: { id: true, name: true },
  });
  // DailyRecord ya no tiene cycleId — comparacion por ciclo no calculable sin join por assignments.
  const cycleComparison = allCycles.map((c) => ({
    cycleName: c.name,
    totalDesigned: 0,
    totalExecuted: 0,
    totalDefects: 0,
    executionRatio: 0,
  }));

  const dailyDetail: DailyDetailRow[] = records.map((r) => ({
    date: r.date.toISOString().split("T")[0],
    testerName: r.tester?.name ?? "Unknown",
    cycleName: "-",
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

// GET /weekly-pptx — Avance Semanal QA en PPTX (auto-generado desde los datos)
// Query: ?weekStart=YYYY-MM-DD (opcional, default lunes de la semana actual)
// Incluye proyectos con asignaciones activas o en UAT/WAITING_UAT
const ACTIVE_OR_UAT = [
  "REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY",
  "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT",
] as const;

router.get(
  "/weekly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const weekStartParam = (req.query.weekStart as string | undefined)?.slice(0, 10);
      const clientIdFilter = req.query.clientId as string | undefined;
      const monday = weekStartParam
        ? new Date(weekStartParam)
        : startOfWeek(new Date(), { weekStartsOn: 1 });
      const friday = addDays(monday, 4);

      // Scope de proyectos accesibles
      const projectScope: any = {};
      if (isClientPm(req)) {
        const ids = await clientPmProjectIds(req.user!.id);
        projectScope.id = { in: ids };
      } else if (isAnalyst(req)) {
        const ids = await analystProjectIds(req.user!.id);
        projectScope.id = { in: ids };
      } else {
        projectScope.client = { userId: req.user!.id };
      }
      // Filtro adicional por cliente (opcional)
      if (clientIdFilter) {
        projectScope.clientId = clientIdFilter;
      }

      // Proyectos con al menos una asignación en los estados incluidos cuyo rango
      // toque la semana (startDate <= friday y endDate >= monday o null)
      const projects = await prisma.project.findMany({
        where: {
          ...projectScope,
          stories: {
            some: {
              assignments: {
                some: {
                  status: { in: [...ACTIVE_OR_UAT] },
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
          projectManager: { select: { name: true } },
          testers: {
            select: { id: true, name: true, allocation: true },
            orderBy: { allocation: "desc" },
          },
          stories: {
            select: {
              id: true,
              title: true,
              externalId: true,
              assignments: {
                where: {
                  status: { in: [...ACTIVE_OR_UAT] },
                },
                select: {
                  id: true,
                  status: true,
                  testerId: true,
                  dailyRecords: {
                    where: { date: { gte: monday, lte: friday } },
                    select: { designed: true, executed: true, defects: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const projectSlides: WeeklyProjectSlide[] = projects.map((p) => {
        // Tester dominante del proyecto: el que aparece en más assignments de la semana
        const testerHits = new Map<string, number>();
        for (const story of p.stories) {
          for (const a of story.assignments) {
            testerHits.set(a.testerId, (testerHits.get(a.testerId) ?? 0) + 1);
          }
        }
        let dominantTesterId: string | null = null;
        let maxHits = 0;
        for (const [tid, hits] of testerHits) {
          if (hits > maxHits) { maxHits = hits; dominantTesterId = tid; }
        }
        const dominantTester = p.testers.find((t) => t.id === dominantTesterId) ?? p.testers[0] ?? null;

        // HUs: cada story con al menos 1 assignment en la semana
        const hus = p.stories
          .filter((s) => s.assignments.length > 0)
          .map((s) => {
            // Agregar métricas de todos los assignments de esta story en la semana
            const flatRecords = s.assignments.flatMap((a) => a.dailyRecords);
            const designed = flatRecords.reduce((sum, r) => sum + r.designed, 0);
            const executed = flatRecords.reduce((sum, r) => sum + r.executed, 0);
            const defects = flatRecords.reduce((sum, r) => sum + r.defects, 0);
            const hasAnyRecord = flatRecords.length > 0;

            // Estado: el más "avanzado" entre los assignments (o cualquiera; tomamos el primero)
            const status = s.assignments[0]?.status ?? "REGISTERED";

            const title = s.externalId ? `${s.externalId} — ${s.title}` : s.title;
            return {
              title,
              status,
              designed: hasAnyRecord ? designed : null,
              executed: hasAnyRecord ? executed : null,
              defects: hasAnyRecord ? defects : null,
            };
          });

        return {
          projectName: p.name,
          clientName: p.client.name,
          projectManagerName: p.projectManager?.name ?? null,
          testerName: dominantTester?.name ?? null,
          testerAllocation: dominantTester?.allocation ?? null,
          hus,
        };
      });

      // ── Agregar dataset para los 3 gráficos ──
      // Pipeline: agrupa por label del estado mapeado
      const STATUS_LABEL_INLINE: Record<string, string> = {
        REGISTERED: "No Iniciado",
        ANALYSIS: "En Diseño",
        TEST_DESIGN: "En Diseño",
        WAITING_QA_DEPLOY: "Pdte. Instalación QA",
        EXECUTION: "En Curso",
        RETURNED_TO_DEV: "Devuelto a Desarrollo",
        WAITING_UAT: "Pdte. Aprobación",
        UAT: "Pdte. Aprobación",
        PRODUCTION: "Completado",
        ON_HOLD: "Detenido",
      };
      const pipelineMap = new Map<string, number>();
      const projectMetrics: ProjectMetricsDatum[] = [];
      for (const p of projects) {
        let d = 0, e = 0, bug = 0;
        for (const s of p.stories) {
          for (const a of s.assignments) {
            const label = STATUS_LABEL_INLINE[a.status] ?? a.status;
            pipelineMap.set(label, (pipelineMap.get(label) ?? 0) + 1);
            for (const r of a.dailyRecords) {
              d += r.designed;
              e += r.executed;
              bug += r.defects;
            }
          }
        }
        projectMetrics.push({ projectName: p.name, designed: d, executed: e, defects: bug });
      }
      const pipelineData: PipelineDatum[] = Array.from(pipelineMap.entries()).map(
        ([label, count]) => ({ label, count }),
      );

      // Generar gráficos como PNG (puede fallar si el runtime no tiene canvas)
      let charts: { pipeline: Buffer; designedVsExecuted: Buffer; defects: Buffer } | undefined;
      try {
        const [pipeline, dve, defects] = await Promise.all([
          buildPipelineDonut(pipelineData),
          buildDesignedVsExecutedBars(projectMetrics),
          buildDefectsBars(projectMetrics),
        ]);
        charts = { pipeline, designedVsExecuted: dve, defects };
      } catch (chartErr) {
        // Si chartjs-node-canvas falla (p.ej. sin canvas nativo), no insertamos
        // el slide de resumen y seguimos con el resto del PPTX.
        console.warn("Charts generation failed, omitting summary slide:", chartErr);
      }

      const buffer = await buildWeeklyPptxBuffer({
        weekStart: monday,
        weekEnd: friday,
        projects: projectSlides,
        charts,
      });

      const isoWeek = monday.toISOString().slice(0, 10);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Avance_Semanal_QA_${isoWeek}.pptx"`,
      );
      res.send(buffer);
    } catch (err) {
      console.error("weekly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX semanal" });
    }
  },
);

export default router;
