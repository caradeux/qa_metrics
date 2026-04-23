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
import { computeOccupationBatch } from "../lib/occupation.js";
import { loadHolidaySet, computeMissingWorkdaysSync } from "../lib/workdays.js";

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
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const weekStartParam = (req.query.weekStart as string | undefined)?.slice(0, 10);
      const clientIdFilter = req.query.clientId as string | undefined;
      const monday = weekStartParam ? new Date(`${weekStartParam}T00:00:00Z`) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const friday = addDays(monday, 4);
      const periodEnd = new Date(friday.getTime() + 24 * 3600 * 1000 - 1);

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientRecord = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "weekly",
        periodStart: monday,
        periodEnd,
        scope,
        clientFilter: clientRecord ? { id: clientRecord.id, name: clientRecord.name } : null,
        userRole: req.user!.role.name,
        userId: req.user!.id,
      });

      const buffer = await buildReportPptx(spec);
      const iso = monday.toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Semanal_${iso}.pptx"`);
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
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const monthParam = (req.query.month as string | undefined) ?? format(new Date(), "yyyy-MM");
      const clientIdFilter = req.query.clientId as string | undefined;
      const monthDate = new Date(`${monthParam}-01T00:00:00Z`);
      const periodStart = startOfMonth(monthDate);
      const periodEnd = endOfMonth(monthDate);

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientRecord = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "monthly",
        periodStart,
        periodEnd,
        scope,
        clientFilter: clientRecord ? { id: clientRecord.id, name: clientRecord.name } : null,
        userRole: req.user!.role.name,
        userId: req.user!.id,
      });

      const buffer = await buildReportPptx(spec);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Mensual_${monthParam}.pptx"`);
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
      const { buildReportSpec, buildProjectScope } = await import("../lib/pptx/report-data.js");
      const { buildReportPptx } = await import("../lib/pptx/build-report-pptx.js");

      const year = Number(req.query.year) || new Date().getFullYear();
      const clientIdFilter = req.query.clientId as string | undefined;
      const periodStart = new Date(Date.UTC(year, 0, 1));
      const periodEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

      const scope = await buildProjectScope(req, clientIdFilter);
      const clientRecord = clientIdFilter
        ? await prisma.client.findUnique({ where: { id: clientIdFilter }, select: { id: true, name: true } })
        : null;

      const spec = await buildReportSpec({
        period: "yearly",
        periodStart,
        periodEnd,
        scope,
        clientFilter: clientRecord ? { id: clientRecord.id, name: clientRecord.name } : null,
        userRole: req.user!.role.name,
        userId: req.user!.id,
      });

      const buffer = await buildReportPptx(spec);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="Informe_QA_Anual_${year}.pptx"`);
      res.send(buffer);
    } catch (err) {
      console.error("yearly-pptx error:", err);
      res.status(500).json({ error: "Error al generar el PPTX anual" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// GET /occupation — Reporte de ocupación por tester
// Query: ?testerIds=id1,id2  OR  ?projectId=X  &from=YYYY-MM-DD&to=YYYY-MM-DD
// ════════════════════════════════════════════════════════════════════
router.get(
  "/occupation",
  requirePermission("reports-occupation", "read") as any,
  async (req: AuthRequest, res: Response) => {
    const testerIdsParam = req.query.testerIds as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;

    if (!fromParam || !toParam) {
      return res.status(400).json({ error: "from y to son requeridos" });
    }
    const from = new Date(fromParam);
    const to = new Date(toParam);

    let testerIds: string[];
    if (testerIdsParam) {
      testerIds = testerIdsParam.split(",").filter(Boolean);
    } else if (projectId) {
      const list = await prisma.tester.findMany({ where: { projectId }, select: { id: true } });
      testerIds = list.map((t) => t.id);
    } else {
      return res.status(400).json({ error: "testerIds o projectId son requeridos" });
    }

    // Scope filtering by role
    const role = req.user!.role.name;
    if (role === "QA_ANALYST") {
      const mine = await prisma.tester.findMany({
        where: { id: { in: testerIds }, userId: req.user!.id },
        select: { id: true },
      });
      testerIds = mine.map((t) => t.id);
    } else if (isClientPm(req)) {
      const pids = await clientPmProjectIds(req.user!.id);
      const allowed = await prisma.tester.findMany({
        where: { id: { in: testerIds }, projectId: { in: pids } },
        select: { id: true },
      });
      testerIds = allowed.map((t) => t.id);
    }

    const results = await computeOccupationBatch(testerIds, from, to);
    res.json(results);
  }
);

// ════════════════════════════════════════════════════════════════════
// GET /story-breakdown — Conglomerado de métricas por HU y ciclo
// Query: ?projectId=X (obligatorio) &storyId=Y (opcional)
// Responde array de stories con cycles + totals D/E/B.
// ════════════════════════════════════════════════════════════════════
router.get(
  "/story-breakdown",
  requirePermission("reports-stories", "read") as any,
  async (req: AuthRequest, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const storyId = req.query.storyId as string | undefined;

    if (!projectId) {
      return res.status(400).json({ error: "projectId es requerido" });
    }

    // Scope filtering por rol
    if (isClientPm(req)) {
      const pids = await clientPmProjectIds(req.user!.id);
      if (!pids.includes(projectId)) return res.status(403).json({ error: "Sin acceso" });
    } else if (isAnalyst(req)) {
      const pids = await analystProjectIds(req.user!.id);
      if (!pids.includes(projectId)) return res.status(403).json({ error: "Sin acceso" });
    }

    const stories = await prisma.userStory.findMany({
      where: { projectId, ...(storyId ? { id: storyId } : {}) },
      select: {
        id: true,
        externalId: true,
        title: true,
        cycles: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            assignments: {
              select: {
                dailyRecords: {
                  select: { date: true, designed: true, executed: true, defects: true },
                },
              },
            },
          },
          orderBy: [{ startDate: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ externalId: "asc" }, { title: "asc" }],
    });

    const today = new Date();

    // Pre-cargar holidays una sola vez en el rango cubierto por los cycles.
    let minStart: Date | null = null;
    let maxEnd: Date = today;
    for (const s of stories) {
      for (const c of s.cycles) {
        if (c.startDate && (!minStart || c.startDate < minStart)) minStart = c.startDate;
        if (c.endDate && c.endDate > maxEnd) maxEnd = c.endDate;
      }
    }
    const holidaySet = minStart ? await loadHolidaySet(minStart, maxEnd) : new Set<number>();

    const out = stories.map((s) => {
      const cycles = s.cycles.map((c) => {
        const records = c.assignments.flatMap((a) => a.dailyRecords);
        const designed = records.reduce((sum, r) => sum + r.designed, 0);
        const executed = records.reduce((sum, r) => sum + r.executed, 0);
        const defects = records.reduce((sum, r) => sum + r.defects, 0);

        const registeredIso = new Set(
          records.map((r) => r.date.toISOString().slice(0, 10)),
        );
        const missingDays = computeMissingWorkdaysSync(
          {
            startDate: c.startDate,
            endDate: c.endDate,
            registeredIso,
            today,
          },
          holidaySet,
        );

        return {
          cycleId: c.id,
          cycleName: c.name,
          startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
          endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
          designed,
          executed,
          defects,
          hasRecords: records.length > 0,
          missingDays,
          missingDaysCount: missingDays.length,
        };
      });
      const totals = cycles.reduce(
        (acc, c) => ({
          designed: acc.designed + c.designed,
          executed: acc.executed + c.executed,
          defects: acc.defects + c.defects,
        }),
        { designed: 0, executed: 0, defects: 0 },
      );
      return {
        id: s.id,
        externalId: s.externalId,
        title: s.title,
        cycles,
        totals,
      };
    });

    res.json(out);
  },
);

export default router;
