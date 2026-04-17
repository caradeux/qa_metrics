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
  buildMonthlyCumulativeBars,
  buildYearlyCumulativeBars,
  type PipelineDatum,
  type ProjectMetricsDatum,
  type WeekBucket,
  type MonthBucket,
} from "../lib/weekly-charts.js";
import { addDays, startOfWeek, startOfMonth, endOfMonth, format, getISOWeek } from "date-fns";
import { es } from "date-fns/locale";
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

      // ── Acumulado mensual: DailyRecords desde el 1° del mes hasta friday ──
      const monthStart = startOfMonth(monday);
      const monthlyRecords = await prisma.dailyRecord.findMany({
        where: {
          date: { gte: monthStart, lte: friday },
          tester: { project: projectScope },
          ...(clientIdFilter ? { tester: { project: { ...projectScope, clientId: clientIdFilter } } } : {}),
        },
        select: { date: true, designed: true, executed: true, defects: true },
      });
      const weekBuckets = new Map<string, WeekBucket>();
      for (const r of monthlyRecords) {
        const ws = startOfWeek(r.date, { weekStartsOn: 1 });
        const key = ws.toISOString().slice(0, 10);
        const label = `Sem ${getISOWeek(ws)}`;
        const b = weekBuckets.get(key) ?? { label, designed: 0, executed: 0, defects: 0 };
        b.designed += r.designed;
        b.executed += r.executed;
        b.defects += r.defects;
        weekBuckets.set(key, b);
      }
      const sortedWeeks = [...weekBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
      const monthLabel = format(monday, "MMMM yyyy", { locale: es });

      // Generar gráficos como PNG (puede fallar si el runtime no tiene canvas)
      let charts: { pipeline: Buffer; designedVsExecuted: Buffer; defects: Buffer; monthlyCumulative?: Buffer } | undefined;
      try {
        const [pipeline, dve, defects, monthly] = await Promise.all([
          buildPipelineDonut(pipelineData),
          buildDesignedVsExecutedBars(projectMetrics),
          buildDefectsBars(projectMetrics),
          sortedWeeks.length > 0 ? buildMonthlyCumulativeBars(sortedWeeks, monthLabel) : Promise.resolve(undefined),
        ]);
        charts = { pipeline, designedVsExecuted: dve, defects, monthlyCumulative: monthly };
      } catch (chartErr) {
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

// ════════════════════════════════════════════════════════════════════
// GET /monthly-pptx — Reporte mensual
// Query: ?month=YYYY-MM  &clientId=X (opcional)
// ════════════════════════════════════════════════════════════════════
router.get(
  "/monthly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const monthParam = (req.query.month as string | undefined) ?? format(new Date(), "yyyy-MM");
      const clientIdFilter = req.query.clientId as string | undefined;
      const monthDate = new Date(`${monthParam}-01T00:00:00`);
      const monthStartD = startOfMonth(monthDate);
      const monthEndD = endOfMonth(monthDate);

      const projectScope: any = {};
      if (isClientPm(req)) {
        projectScope.id = { in: await clientPmProjectIds(req.user!.id) };
      } else if (isAnalyst(req)) {
        projectScope.id = { in: await analystProjectIds(req.user!.id) };
      } else {
        projectScope.client = { userId: req.user!.id };
      }
      if (clientIdFilter) projectScope.clientId = clientIdFilter;

      const projects = await prisma.project.findMany({
        where: {
          ...projectScope,
          stories: { some: { assignments: { some: { status: { in: [...ACTIVE_OR_UAT] } } } } },
        },
        select: {
          id: true, name: true,
          client: { select: { name: true } },
          projectManager: { select: { name: true } },
          testers: { select: { id: true, name: true, allocation: true }, orderBy: { allocation: "desc" } },
          stories: {
            select: {
              id: true, title: true, externalId: true,
              assignments: {
                where: { status: { in: [...ACTIVE_OR_UAT] } },
                select: {
                  id: true, status: true, testerId: true,
                  dailyRecords: {
                    where: { date: { gte: monthStartD, lte: monthEndD } },
                    select: { date: true, designed: true, executed: true, defects: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const projectSlides: WeeklyProjectSlide[] = projects.map((p) => {
        const testerHits = new Map<string, number>();
        for (const s of p.stories) for (const a of s.assignments) testerHits.set(a.testerId, (testerHits.get(a.testerId) ?? 0) + 1);
        let dominantTesterId: string | null = null, maxHits = 0;
        for (const [tid, hits] of testerHits) if (hits > maxHits) { maxHits = hits; dominantTesterId = tid; }
        const dt = p.testers.find((t) => t.id === dominantTesterId) ?? p.testers[0] ?? null;
        const hus = p.stories.filter((s) => s.assignments.length > 0).map((s) => {
          const flat = s.assignments.flatMap((a) => a.dailyRecords);
          const designed = flat.reduce((s, r) => s + r.designed, 0);
          const executed = flat.reduce((s, r) => s + r.executed, 0);
          const defects = flat.reduce((s, r) => s + r.defects, 0);
          const title = s.externalId ? `${s.externalId} — ${s.title}` : s.title;
          return { title, status: s.assignments[0]?.status ?? "REGISTERED", designed: flat.length ? designed : null, executed: flat.length ? executed : null, defects: flat.length ? defects : null };
        });
        return { projectName: p.name, clientName: p.client.name, projectManagerName: p.projectManager?.name ?? null, testerName: dt?.name ?? null, testerAllocation: dt?.allocation ?? null, hus };
      });

      // Charts
      const STATUS_LABEL_M: Record<string, string> = { REGISTERED: "No Iniciado", ANALYSIS: "En Diseño", TEST_DESIGN: "En Diseño", WAITING_QA_DEPLOY: "Pdte. Instalación QA", EXECUTION: "En Curso", RETURNED_TO_DEV: "Devuelto a Desarrollo", WAITING_UAT: "Pdte. Aprobación", UAT: "Pdte. Aprobación", PRODUCTION: "Completado", ON_HOLD: "Detenido" };
      const pipelineMap = new Map<string, number>();
      const projectMetrics: ProjectMetricsDatum[] = [];
      for (const p of projects) {
        let d = 0, e = 0, bug = 0;
        for (const s of p.stories) for (const a of s.assignments) {
          pipelineMap.set(STATUS_LABEL_M[a.status] ?? a.status, (pipelineMap.get(STATUS_LABEL_M[a.status] ?? a.status) ?? 0) + 1);
          for (const r of a.dailyRecords) { d += r.designed; e += r.executed; bug += r.defects; }
        }
        projectMetrics.push({ projectName: p.name, designed: d, executed: e, defects: bug });
      }
      const pipelineData: PipelineDatum[] = [...pipelineMap.entries()].map(([label, count]) => ({ label, count }));

      // Weekly buckets within the month
      const allRecords = projects.flatMap((p) => p.stories.flatMap((s) => s.assignments.flatMap((a) => a.dailyRecords)));
      const wbMap = new Map<string, WeekBucket>();
      for (const r of allRecords) {
        const ws = startOfWeek(r.date, { weekStartsOn: 1 });
        const key = ws.toISOString().slice(0, 10);
        const b = wbMap.get(key) ?? { label: `Sem ${getISOWeek(ws)}`, designed: 0, executed: 0, defects: 0 };
        b.designed += r.designed; b.executed += r.executed; b.defects += r.defects;
        wbMap.set(key, b);
      }
      const sortedWeeks = [...wbMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
      const mLabel = format(monthDate, "MMMM yyyy", { locale: es });

      let charts: any;
      try {
        const [pipeline, dve, defects, monthly] = await Promise.all([
          buildPipelineDonut(pipelineData),
          buildDesignedVsExecutedBars(projectMetrics),
          buildDefectsBars(projectMetrics),
          sortedWeeks.length > 0 ? buildMonthlyCumulativeBars(sortedWeeks, mLabel) : Promise.resolve(undefined),
        ]);
        charts = { pipeline, designedVsExecuted: dve, defects, monthlyCumulative: monthly };
      } catch {}

      const buffer = await buildWeeklyPptxBuffer({ weekStart: monthStartD, weekEnd: monthEndD, projects: projectSlides, charts });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Avance_Mensual_QA_${monthParam}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("monthly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX mensual" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// GET /yearly-pptx — Reporte anual
// Query: ?year=YYYY  &clientId=X (opcional)
// ════════════════════════════════════════════════════════════════════
router.get(
  "/yearly-pptx",
  requirePermission("reports", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const clientIdFilter = req.query.clientId as string | undefined;
      const yearStart = new Date(`${year}-01-01T00:00:00`);
      const yearEnd = new Date(`${year}-12-31T23:59:59`);

      const projectScope: any = {};
      if (isClientPm(req)) {
        projectScope.id = { in: await clientPmProjectIds(req.user!.id) };
      } else if (isAnalyst(req)) {
        projectScope.id = { in: await analystProjectIds(req.user!.id) };
      } else {
        projectScope.client = { userId: req.user!.id };
      }
      if (clientIdFilter) projectScope.clientId = clientIdFilter;

      const projects = await prisma.project.findMany({
        where: {
          ...projectScope,
          stories: { some: { assignments: { some: { status: { in: [...ACTIVE_OR_UAT] } } } } },
        },
        select: {
          id: true, name: true,
          client: { select: { name: true } },
          projectManager: { select: { name: true } },
          testers: { select: { id: true, name: true, allocation: true }, orderBy: { allocation: "desc" } },
          stories: {
            select: {
              id: true, title: true, externalId: true,
              assignments: {
                where: { status: { in: [...ACTIVE_OR_UAT] } },
                select: {
                  id: true, status: true, testerId: true,
                  dailyRecords: {
                    where: { date: { gte: yearStart, lte: yearEnd } },
                    select: { date: true, designed: true, executed: true, defects: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const projectSlides: WeeklyProjectSlide[] = projects.map((p) => {
        const testerHits = new Map<string, number>();
        for (const s of p.stories) for (const a of s.assignments) testerHits.set(a.testerId, (testerHits.get(a.testerId) ?? 0) + 1);
        let dominantTesterId: string | null = null, maxHits = 0;
        for (const [tid, hits] of testerHits) if (hits > maxHits) { maxHits = hits; dominantTesterId = tid; }
        const dt = p.testers.find((t) => t.id === dominantTesterId) ?? p.testers[0] ?? null;
        const hus = p.stories.filter((s) => s.assignments.length > 0).map((s) => {
          const flat = s.assignments.flatMap((a) => a.dailyRecords);
          const designed = flat.reduce((s, r) => s + r.designed, 0);
          const executed = flat.reduce((s, r) => s + r.executed, 0);
          const defects = flat.reduce((s, r) => s + r.defects, 0);
          const title = s.externalId ? `${s.externalId} — ${s.title}` : s.title;
          return { title, status: s.assignments[0]?.status ?? "REGISTERED", designed: flat.length ? designed : null, executed: flat.length ? executed : null, defects: flat.length ? defects : null };
        });
        return { projectName: p.name, clientName: p.client.name, projectManagerName: p.projectManager?.name ?? null, testerName: dt?.name ?? null, testerAllocation: dt?.allocation ?? null, hus };
      });

      // Pipeline + per-project
      const STATUS_LABEL_Y: Record<string, string> = { REGISTERED: "No Iniciado", ANALYSIS: "En Diseño", TEST_DESIGN: "En Diseño", WAITING_QA_DEPLOY: "Pdte. Instalación QA", EXECUTION: "En Curso", RETURNED_TO_DEV: "Devuelto a Desarrollo", WAITING_UAT: "Pdte. Aprobación", UAT: "Pdte. Aprobación", PRODUCTION: "Completado", ON_HOLD: "Detenido" };
      const pipelineMap = new Map<string, number>();
      const projectMetrics: ProjectMetricsDatum[] = [];
      for (const p of projects) {
        let d = 0, e = 0, bug = 0;
        for (const s of p.stories) for (const a of s.assignments) {
          pipelineMap.set(STATUS_LABEL_Y[a.status] ?? a.status, (pipelineMap.get(STATUS_LABEL_Y[a.status] ?? a.status) ?? 0) + 1);
          for (const r of a.dailyRecords) { d += r.designed; e += r.executed; bug += r.defects; }
        }
        projectMetrics.push({ projectName: p.name, designed: d, executed: e, defects: bug });
      }
      const pipelineData: PipelineDatum[] = [...pipelineMap.entries()].map(([label, count]) => ({ label, count }));

      // Monthly buckets for the year
      const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const allRecords = projects.flatMap((p) => p.stories.flatMap((s) => s.assignments.flatMap((a) => a.dailyRecords)));
      const mbMap = new Map<number, MonthBucket>();
      for (const r of allRecords) {
        const m = r.date.getMonth();
        const b = mbMap.get(m) ?? { label: MONTH_NAMES[m]!, designed: 0, executed: 0, defects: 0 };
        b.designed += r.designed; b.executed += r.executed; b.defects += r.defects;
        mbMap.set(m, b);
      }
      const sortedMonths: MonthBucket[] = [];
      for (let i = 0; i < 12; i++) {
        sortedMonths.push(mbMap.get(i) ?? { label: MONTH_NAMES[i]!, designed: 0, executed: 0, defects: 0 });
      }

      let charts: any;
      try {
        const [pipeline, dve, defects, yearly] = await Promise.all([
          buildPipelineDonut(pipelineData),
          buildDesignedVsExecutedBars(projectMetrics),
          buildDefectsBars(projectMetrics),
          buildYearlyCumulativeBars(sortedMonths, year),
        ]);
        // Re-use monthlyCumulative slot for the yearly chart
        charts = { pipeline, designedVsExecuted: dve, defects, monthlyCumulative: yearly };
      } catch {}

      const buffer = await buildWeeklyPptxBuffer({ weekStart: yearStart, weekEnd: yearEnd, projects: projectSlides, charts });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Avance_Anual_QA_${year}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("yearly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX anual" });
    }
  },
);

export default router;
