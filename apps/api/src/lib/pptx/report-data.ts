import { prisma } from "@qa-metrics/database";
import type { AuthRequest } from "../../middleware/auth.js";
import { isClientPm, isAnalyst, clientPmProjectIds, analystProjectIds } from "../access.js";

const ACTIVE_OR_UAT = [
  "REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY",
  "EXECUTION", "RETURNED_TO_DEV", "WAITING_UAT", "UAT",
] as const;

export async function buildProjectScope(
  req: AuthRequest,
  clientIdFilter?: string,
): Promise<Record<string, unknown>> {
  const scope: Record<string, unknown> = {};
  if (isClientPm(req)) {
    scope.id = { in: await clientPmProjectIds(req.user!.id) };
  } else if (isAnalyst(req)) {
    scope.id = { in: await analystProjectIds(req.user!.id) };
  } else {
    scope.client = { userId: req.user!.id };
  }
  if (clientIdFilter) scope.clientId = clientIdFilter;
  return scope;
}

export async function loadScopedProjects(
  scope: Record<string, unknown>,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.project.findMany({
    where: {
      ...scope,
      stories: { some: { assignments: { some: { status: { in: [...ACTIVE_OR_UAT] } } } } },
    },
    select: {
      id: true,
      name: true,
      client: { select: { id: true, name: true } },
      projectManager: { select: { name: true } },
      testers: {
        select: { id: true, name: true, allocation: true, userId: true },
        orderBy: { allocation: "desc" },
      },
      stories: {
        select: {
          id: true,
          externalId: true,
          title: true,
          designComplexity: true,
          executionComplexity: true,
          cycles: { select: { id: true } },
          assignments: {
            where: { status: { in: [...ACTIVE_OR_UAT] } },
            select: {
              id: true,
              status: true,
              testerId: true,
              phases: {
                select: { phase: true, startDate: true, endDate: true },
              },
              dailyRecords: {
                where: { date: { gte: periodStart, lte: periodEnd } },
                select: { date: true, designed: true, executed: true, defects: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type LoadedProject = Awaited<ReturnType<typeof loadScopedProjects>>[number];

import { startOfWeek, format, getISOWeek } from "date-fns";
import { es } from "date-fns/locale";
import { loadHolidaySet } from "../workdays.js";
import { computeOccupationBatch } from "../occupation.js";
import {
  aggregateOccupationCurve,
  type BucketingMode,
  type PhaseSegment,
  type ActivityRef,
  type TesterRef,
} from "./occupation-math.js";
import type {
  ReportSpec,
  ReportPeriod,
  ProjectReportData,
  HuRow,
  ComplexityBubble,
  ProjectPipeline,
  PortfolioTrendPoint,
  ComplexityLevel,
} from "./types.js";
import { PALETTE } from "./theme.js";

const STATUS_LABEL: Record<string, string> = {
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

const STATUS_COLOR: Record<string, string> = {
  "No Iniciado": PALETTE.textMuted,
  "En Diseño": PALETTE.phaseDesign,
  "Pdte. Instalación QA": PALETTE.amber,
  "En Curso": PALETTE.greenPrimary,
  "Devuelto a Desarrollo": PALETTE.red,
  "Pdte. Aprobación": PALETTE.purple,
  "Completado": PALETTE.greenPrimary,
  "Detenido": PALETTE.textMuted,
};

export interface BuildSpecInput {
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  scope: Record<string, unknown>;
  clientFilter: { id: string; name: string } | null;
  userRole: string;
  userId: string;
}

function bucketingFor(period: ReportPeriod): BucketingMode {
  if (period === "weekly") return "daily";
  if (period === "monthly") return "weekly";
  return "monthly";
}

function periodLabel(period: ReportPeriod, start: Date, end: Date): string {
  if (period === "weekly") {
    const d1 = format(start, "d", { locale: es });
    const d2 = format(end, "d", { locale: es });
    const m = format(end, "MMMM yyyy", { locale: es });
    return `Semana del ${d1} al ${d2} de ${m}`;
  }
  if (period === "monthly") return format(start, "MMMM yyyy", { locale: es });
  return `Año ${format(start, "yyyy")}`;
}

export async function buildReportSpec(input: BuildSpecInput): Promise<ReportSpec> {
  const { period, periodStart, periodEnd, scope, clientFilter, userRole, userId } = input;

  const loaded = await loadScopedProjects(scope, periodStart, periodEnd);
  const holidaysSet = await loadHolidaySet(periodStart, periodEnd);
  const holidaysMs = new Set<number>(Array.from(holidaysSet));

  // Pre-calcular mapping tester → proyectos activos (para split transversal).
  const testerToProjects = new Map<string, string[]>();
  for (const p of loaded) {
    for (const t of p.testers) {
      const arr = testerToProjects.get(t.id) ?? [];
      if (!arr.includes(p.id)) arr.push(p.id);
      testerToProjects.set(t.id, arr);
    }
  }

  const testerIds = Array.from(testerToProjects.keys());

  // Todas las activities del periodo para esos testers.
  const activitiesRaw = testerIds.length === 0 ? [] : await prisma.activity.findMany({
    where: {
      testerId: { in: testerIds },
      startAt: { lt: periodEnd },
      endAt: { gt: periodStart },
    },
    include: {
      category: { select: { name: true } },
      assignment: { select: { id: true, story: { select: { projectId: true } } } },
    },
  });

  const activitiesByTester = new Map<string, ActivityRef[]>();
  const activitiesByAssignment = new Map<string, Array<{ categoryName: string; hours: number }>>();
  const MS_PER_HOUR = 3600000;
  for (const a of activitiesRaw) {
    const list = activitiesByTester.get(a.testerId) ?? [];
    list.push({
      testerId: a.testerId,
      categoryName: a.category.name,
      assignmentProjectId: a.assignment?.story?.projectId ?? null,
      start: a.startAt,
      end: a.endAt,
    });
    activitiesByTester.set(a.testerId, list);

    if (a.assignment?.id) {
      const start = a.startAt.getTime() < periodStart.getTime() ? periodStart.getTime() : a.startAt.getTime();
      const end = a.endAt.getTime() > periodEnd.getTime() ? periodEnd.getTime() : a.endAt.getTime();
      const hours = Math.max(0, (end - start) / MS_PER_HOUR);
      if (hours > 0) {
        const arr = activitiesByAssignment.get(a.assignment.id) ?? [];
        arr.push({ categoryName: a.category.name, hours });
        activitiesByAssignment.set(a.assignment.id, arr);
      }
    }
  }

  const projects: ProjectReportData[] = loaded.map((p) => {
    const testersRefs: TesterRef[] = p.testers.map((t) => ({
      id: t.id,
      allocation: t.allocation,
      projectIdsActive: testerToProjects.get(t.id) ?? [p.id],
    }));

    // Phase segments de este proyecto.
    const phaseSegments: PhaseSegment[] = [];
    for (const story of p.stories) {
      for (const a of story.assignments) {
        for (const ph of a.phases) {
          phaseSegments.push({
            testerId: a.testerId,
            projectId: p.id,
            type: ph.phase,
            start: ph.startDate,
            end: ph.endDate,
          });
        }
      }
    }
    // Añadir phases de otros proyectos para los testers compartidos.
    for (const t of p.testers) {
      const otherProjects = (testerToProjects.get(t.id) ?? []).filter((pid) => pid !== p.id);
      for (const other of otherProjects) {
        const otherProj = loaded.find((pp) => pp.id === other);
        if (!otherProj) continue;
        for (const story of otherProj.stories) {
          for (const a of story.assignments) {
            if (a.testerId !== t.id) continue;
            for (const ph of a.phases) {
              phaseSegments.push({
                testerId: t.id,
                projectId: other,
                type: ph.phase,
                start: ph.startDate,
                end: ph.endDate,
              });
            }
          }
        }
      }
    }

    const activitiesForProject: ActivityRef[] = [];
    for (const t of p.testers) {
      for (const a of activitiesByTester.get(t.id) ?? []) {
        activitiesForProject.push(a);
      }
    }

    const curve = aggregateOccupationCurve({
      projectId: p.id,
      from: periodStart,
      to: periodEnd,
      bucketing: bucketingFor(period),
      testers: testersRefs,
      phaseSegments,
      activities: activitiesForProject,
      holidaysMs,
    });

    const hus: HuRow[] = [];
    const bubbles: ComplexityBubble[] = [];
    const pipelineMap = new Map<string, number>();
    let designed = 0, executed = 0, defects = 0;

    for (const s of p.stories.filter((st) => st.assignments.length > 0)) {
      const flat = s.assignments.flatMap((a) => a.dailyRecords);
      const sd = flat.reduce((acc, r) => acc + r.designed, 0);
      const se = flat.reduce((acc, r) => acc + r.executed, 0);
      const sb = flat.reduce((acc, r) => acc + r.defects, 0);
      designed += sd; executed += se; defects += sb;

      let trainingHours = 0;
      let userMeetingHours = 0;
      let devMeetingHours = 0;
      for (const a of s.assignments) {
        for (const act of activitiesByAssignment.get(a.id) ?? []) {
          if (act.categoryName === "Inducción" || act.categoryName === "Capacitación") {
            trainingHours += act.hours;
          } else if (act.categoryName === "Reunión con usuario") {
            userMeetingHours += act.hours;
          } else if (act.categoryName === "Reunión con desarrollo") {
            devMeetingHours += act.hours;
          }
        }
      }

      const statusInternal = s.assignments[0]?.status ?? "REGISTERED";
      const statusLbl = STATUS_LABEL[statusInternal] ?? statusInternal;
      pipelineMap.set(statusLbl, (pipelineMap.get(statusLbl) ?? 0) + 1);

      hus.push({
        storyId: s.id,
        externalId: s.externalId,
        title: s.title,
        regressionNumber: s.cycles.length,
        designComplexity: s.designComplexity as ComplexityLevel,
        executionComplexity: s.executionComplexity as ComplexityLevel,
        status: statusInternal,
        statusLabel: statusLbl,
        designed: sd,
        executed: se,
        defects: sb,
        trainingHours: Math.round(trainingHours * 10) / 10,
        userMeetingHours: Math.round(userMeetingHours * 10) / 10,
        devMeetingHours: Math.round(devMeetingHours * 10) / 10,
      });

      bubbles.push({
        storyId: s.id,
        title: s.externalId ? `${s.externalId} — ${s.title}` : s.title,
        designComplexity: s.designComplexity as ComplexityLevel,
        executionComplexity: s.executionComplexity as ComplexityLevel,
        size: sd + se,
        statusLabel: statusLbl,
      });
    }

    const pipeline: ProjectPipeline[] = Array.from(pipelineMap.entries()).map(([label, count]) => ({
      label,
      count,
      colorHex: STATUS_COLOR[label] ?? PALETTE.textMuted,
    }));

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      projectManagerName: p.projectManager?.name ?? null,
      testers: p.testers.map((t) => ({ id: t.id, name: t.name, allocation: t.allocation })),
      kpis: { designed, executed, defects },
      pipeline,
      hus,
      complexityBubbles: bubbles,
      occupationCurve: curve,
    };
  });

  // Portfolio KPIs.
  const portD = projects.reduce((s, p) => s + p.kpis.designed, 0);
  const portE = projects.reduce((s, p) => s + p.kpis.executed, 0);
  const portB = projects.reduce((s, p) => s + p.kpis.defects, 0);
  const ratioPct = portD > 0 ? Math.round((portE / portD) * 100) : 0;

  let husFirstCycle = 0;
  let husMultipleCycles = 0;
  for (const p of projects) {
    for (const h of p.hus) {
      if (h.regressionNumber <= 1) husFirstCycle++;
      else husMultipleCycles++;
    }
  }

  let totalBands = 0;
  let totalCapacity = 0;
  for (const p of projects) {
    for (const b of p.occupationCurve.buckets) totalCapacity += b.capacityHours;
    for (const band of p.occupationCurve.bands) {
      for (const v of band.values) totalBands += v;
    }
  }
  const capacityUtilizationPct = totalCapacity > 0
    ? Math.round((totalBands / totalCapacity) * 100)
    : 0;

  const portPipelineMap = new Map<string, ProjectPipeline>();
  for (const p of projects) {
    for (const it of p.pipeline) {
      const cur = portPipelineMap.get(it.label) ?? { label: it.label, count: 0, colorHex: it.colorHex };
      cur.count += it.count;
      portPipelineMap.set(it.label, cur);
    }
  }

  const comparison = projects.map((p) => ({
    projectName: p.projectName,
    designed: p.kpis.designed,
    executed: p.kpis.executed,
  }));

  const trend = await buildPortfolioTrend(period, periodStart, periodEnd, scope);

  // Ocupación por analista (anexo interno).
  const includeInternalAppendix = userRole !== "CLIENT_PM";
  let analysts: Awaited<ReturnType<typeof computeOccupationBatch>> = [];
  if (includeInternalAppendix && testerIds.length > 0) {
    if (userRole === "QA_ANALYST") {
      const mine = await prisma.tester.findMany({
        where: { id: { in: testerIds }, userId },
        select: { id: true },
      });
      const myTesterIds = mine.map((m) => m.id);
      analysts = await computeOccupationBatch(myTesterIds, periodStart, periodEnd);
    } else {
      analysts = await computeOccupationBatch(testerIds, periodStart, periodEnd);
    }
  }

  const totalAnalysts = new Set(projects.flatMap((p) => p.testers.map((t) => t.id))).size;

  return {
    period,
    periodStart,
    periodEnd,
    periodLabel: periodLabel(period, periodStart, periodEnd),
    clientFilter,
    projects,
    analysts,
    portfolio: {
      kpis: {
        designed: portD,
        executed: portE,
        defects: portB,
        ratioPct,
        husFirstCycle,
        husMultipleCycles,
        capacityUtilizationPct,
        totalProjects: projects.length,
        totalAnalysts,
      },
      pipeline: Array.from(portPipelineMap.values()),
      comparison,
      trend,
    },
    includeInternalAppendix,
  };
}

async function buildPortfolioTrend(
  period: ReportPeriod,
  periodStart: Date,
  periodEnd: Date,
  scope: Record<string, unknown>,
): Promise<PortfolioTrendPoint[]> {
  const records = await prisma.dailyRecord.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      tester: { project: scope as any },
    },
    select: { date: true, designed: true, executed: true, defects: true },
    orderBy: { date: "asc" },
  });

  const bucket = bucketingFor(period);
  const buckets = new Map<string, PortfolioTrendPoint>();
  for (const r of records) {
    let key: string;
    let label: string;
    if (bucket === "daily") {
      key = r.date.toISOString().slice(0, 10);
      const dow = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][r.date.getUTCDay()]!;
      label = `${dow} ${r.date.getUTCDate()}`;
    } else if (bucket === "weekly") {
      const ws = startOfWeek(r.date, { weekStartsOn: 1 });
      key = ws.toISOString().slice(0, 10);
      label = `Sem ${getISOWeek(ws)}`;
    } else {
      key = format(r.date, "yyyy-MM");
      label = format(r.date, "MMM", { locale: es });
    }
    const cur = buckets.get(key) ?? { label, designed: 0, executed: 0, defects: 0 };
    cur.designed += r.designed;
    cur.executed += r.executed;
    cur.defects += r.defects;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}
