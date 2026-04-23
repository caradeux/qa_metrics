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
  // Incluir assignments en estado activo O con DailyRecord en el periodo
  // (para capturar HUs que pasaron a PRODUCTION esta semana) O en estado
  // ON_HOLD (HUs detenidas siempre deben aparecer en el reporte).
  const VISIBLE_STATUSES = [
    ...ACTIVE_OR_UAT,
    "ON_HOLD" as const,
  ];
  const assignmentFilter = {
    OR: [
      { status: { in: VISIBLE_STATUSES } },
      { dailyRecords: { some: { date: { gte: periodStart, lte: periodEnd } } } },
    ],
  };
  return prisma.project.findMany({
    where: {
      ...scope,
      stories: { some: { assignments: { some: assignmentFilter } } },
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
            where: assignmentFilter,
            select: {
              id: true,
              status: true,
              testerId: true,
              createdAt: true,
              cycle: { select: { id: true, startDate: true } },
              phases: {
                select: { phase: true, startDate: true, endDate: true },
              },
              dailyRecords: {
                where: { date: { gte: periodStart, lte: periodEnd } },
                select: { date: true, designed: true, executed: true, defects: true },
              },
            },
            // Ordenar por fecha de creación para que la primera sea la más
            // reciente y represente el estado actual de la HU.
            orderBy: { createdAt: "desc" },
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
import { computeOccupationBatch, aggregateOccupationByUser } from "../occupation.js";
import {
  aggregateOccupationCurve,
  sumCurves,
  type BucketingMode,
  type PhaseSegment,
  type ActivityRef,
  type TesterRef,
  type DailyRecordRef,
  type AssignmentInfo,
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
  AnalystCapacityCurve,
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
      category: { select: { name: true, bandType: true } },
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
      categoryBandType: a.category.bandType as any,
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

  // DailyRecords del periodo para TODOS los testers, sin filtrar por status del
  // assignment. Esto es clave para la curva de ocupación: trabajo real en HUs
  // que ya pasaron a PRODUCTION no aparece en loadScopedProjects (que filtra
  // por ACTIVE_OR_UAT), pero sí debe clasificarse como "Ejecución" en la curva.
  const allDailyRecordsRaw = testerIds.length === 0 ? [] : await prisma.dailyRecord.findMany({
    where: {
      testerId: { in: testerIds },
      date: { gte: periodStart, lte: periodEnd },
    },
    select: {
      testerId: true,
      date: true,
      designed: true,
      executed: true,
      defects: true,
      assignment: { select: { story: { select: { projectId: true } } } },
    },
  });
  const allDailyRecordsByTester = new Map<string, DailyRecordRef[]>();
  for (const r of allDailyRecordsRaw) {
    const projectId = r.assignment?.story?.projectId;
    if (!projectId) continue;
    const list = allDailyRecordsByTester.get(r.testerId) ?? [];
    list.push({
      testerId: r.testerId,
      date: r.date,
      projectId,
      designed: r.designed,
      executed: r.executed,
      defects: r.defects,
    });
    allDailyRecordsByTester.set(r.testerId, list);
  }

  // Map testerId → ProjectOccupationCurve[] (una entry por proyecto donde trabajó).
  const perTesterCurves = new Map<string, import("./types.js").ProjectOccupationCurve[]>();

  const projects: ProjectReportData[] = loaded.map((p) => {
    const testersRefs: TesterRef[] = p.testers.map((t) => ({
      id: t.id,
      allocation: t.allocation,
      projectIdsActive: testerToProjects.get(t.id) ?? [p.id],
    }));

    // Phase segments de este proyecto. SOLO incluimos phases de assignments en
    // estados activos de QA (ANALYSIS/TEST_DESIGN/EXECUTION). Assignments en
    // REGISTERED, WAITING_*, RETURNED_TO_DEV, UAT, ON_HOLD y PRODUCTION
    // pueden tener phases pre-creadas por planificación, pero no representan
    // trabajo actual — su clasificación debe venir del estado, no de la phase.
    const ACTIVE_QA_STATUSES = new Set(["ANALYSIS", "TEST_DESIGN", "EXECUTION"]);
    const phaseSegments: PhaseSegment[] = [];
    for (const story of p.stories) {
      for (const a of story.assignments) {
        if (!ACTIVE_QA_STATUSES.has(a.status)) continue;
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
    // Añadir phases de otros proyectos para los testers compartidos, con el
    // mismo filtro por estado activo.
    for (const t of p.testers) {
      const otherProjects = (testerToProjects.get(t.id) ?? []).filter((pid) => pid !== p.id);
      for (const other of otherProjects) {
        const otherProj = loaded.find((pp) => pp.id === other);
        if (!otherProj) continue;
        for (const story of otherProj.stories) {
          for (const a of story.assignments) {
            if (a.testerId !== t.id) continue;
            if (!ACTIVE_QA_STATUSES.has(a.status)) continue;
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

    // DailyRecords del periodo para los testers de P, SIN filtrar por status
    // del assignment (incluye PRODUCTION y ON_HOLD). Usamos la query global.
    const dailyRecordsForCurve: DailyRecordRef[] = [];
    for (const t of p.testers) {
      for (const r of allDailyRecordsByTester.get(t.id) ?? []) {
        dailyRecordsForCurve.push(r);
      }
    }

    // AssignmentInfo: lista plana de assignments con su status actual — permite
    // clasificar horas en bandas "Esperando aprobación", "En manos de desarrollo",
    // "Detenido", "No iniciado" cuando no hay DailyRecord ni phase activa.
    const assignmentsInfo: AssignmentInfo[] = [];
    for (const story of p.stories) {
      for (const a of story.assignments) {
        assignmentsInfo.push({
          testerId: a.testerId,
          projectId: p.id,
          status: a.status,
        });
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
      dailyRecords: dailyRecordsForCurve,
      assignments: assignmentsInfo,
      asOfDate: new Date(),
    });

    // Curvas per-tester para este proyecto (una por cada Tester del proyecto).
    for (const tRef of testersRefs) {
      const testerCurve = aggregateOccupationCurve({
        projectId: p.id,
        from: periodStart,
        to: periodEnd,
        bucketing: bucketingFor(period),
        testers: [tRef],
        phaseSegments,
        activities: activitiesForProject,
        holidaysMs,
        dailyRecords: dailyRecordsForCurve,
        assignments: assignmentsInfo,
        asOfDate: new Date(),
      });
      const arr = perTesterCurves.get(tRef.id) ?? [];
      arr.push(testerCurve);
      perTesterCurves.set(tRef.id, arr);
    }

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
      const TRAINING_NAMES = new Set([
        "Inducción", "Induccion", "Capacitación", "Capacitacion",
        "Capacitacion Inovabiz", "Capacitación Inovabiz",
      ]);
      const USER_MEETING_NAMES = new Set([
        "Reunión con usuario", "Reunion con usuario",
        "Aceptacion Casos de Prueba (Presentacion Usuarios)",
        "Aceptación Casos de Prueba (Presentación Usuarios)",
        "Presentacion Usuarios (UAT)", "Presentación Usuarios (UAT)",
      ]);
      const DEV_MEETING_NAMES = new Set([
        "Reunión con desarrollo", "Reunion con desarrollo",
        "Daily Scrum",
      ]);
      for (const a of s.assignments) {
        for (const act of activitiesByAssignment.get(a.id) ?? []) {
          if (TRAINING_NAMES.has(act.categoryName)) trainingHours += act.hours;
          else if (USER_MEETING_NAMES.has(act.categoryName)) userMeetingHours += act.hours;
          else if (DEV_MEETING_NAMES.has(act.categoryName)) devMeetingHours += act.hours;
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

  // "HUs completadas en 1ª regresión" = HUs que efectivamente cerraron en
  // status PRODUCTION y solo tuvieron 1 TestCycle. Las que aún están en proceso
  // (aunque sea R1) NO cuentan aquí.
  let husFirstCycle = 0;
  let husMultipleCycles = 0;
  // "Avance de la semana" = HUs que alcanzaron ejecución o más
  // (EXECUTION/WAITING_UAT/UAT/PRODUCTION) sobre total de HUs del reporte.
  let husAtOrPastExecution = 0;
  let husTotal = 0;
  const AT_OR_PAST_EXECUTION = new Set(["EXECUTION", "WAITING_UAT", "UAT", "PRODUCTION"]);
  for (const p of projects) {
    for (const h of p.hus) {
      husTotal++;
      if (h.status === "PRODUCTION" && h.regressionNumber <= 1) husFirstCycle++;
      if (h.regressionNumber >= 2) husMultipleCycles++;
      if (AT_OR_PAST_EXECUTION.has(h.status)) husAtOrPastExecution++;
    }
  }
  const advancePct = husTotal > 0 ? Math.round((husAtOrPastExecution / husTotal) * 100) : 0;

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
  let rawAnalysts: Awaited<ReturnType<typeof computeOccupationBatch>> = [];
  if (includeInternalAppendix && testerIds.length > 0) {
    if (userRole === "QA_ANALYST") {
      const mine = await prisma.tester.findMany({
        where: { id: { in: testerIds }, userId },
        select: { id: true },
      });
      const myTesterIds = mine.map((m) => m.id);
      rawAnalysts = await computeOccupationBatch(myTesterIds, periodStart, periodEnd);
    } else {
      rawAnalysts = await computeOccupationBatch(testerIds, periodStart, periodEnd);
    }
  }
  // Agrupar por persona + capear al máximo físico 40h/semana.
  const analysts = await aggregateOccupationByUser(rawAnalysts);

  // Conteo de analistas únicos por PERSONA (userId), no por Tester entity.
  // Un mismo analista asignado a 3 proyectos son 3 Testers pero 1 persona.
  const uniquePeople = new Set<string>();
  for (const p of projects) {
    for (const t of p.testers) {
      const loadedP = loaded.find((lp) => lp.id === p.projectId);
      const loadedT = loadedP?.testers.find((lt) => lt.id === t.id);
      uniquePeople.add(loadedT?.userId ?? `anon:${t.id}`);
    }
  }
  const totalAnalysts = uniquePeople.size;

  // ═══════════════════════════════════════════════════════════════
  // Curvas por analista (agrupadas por User.id) + curva consolidada del equipo
  // ═══════════════════════════════════════════════════════════════
  const testerIdToUserKey = new Map<string, string>();
  const testerIdToName = new Map<string, string>();
  const testerIdToProjects = new Map<string, Set<string>>();
  for (const p of loaded) {
    for (const t of p.testers) {
      testerIdToUserKey.set(t.id, t.userId ?? `anon:${t.id}`);
      testerIdToName.set(t.id, t.name);
      const set = testerIdToProjects.get(t.id) ?? new Set<string>();
      set.add(p.name);
      testerIdToProjects.set(t.id, set);
    }
  }
  // Agrupar curves por userKey.
  const curvesByUser = new Map<string, { name: string; curves: import("./types.js").ProjectOccupationCurve[]; projects: Set<string> }>();
  for (const [testerId, curves] of perTesterCurves.entries()) {
    const userKey = testerIdToUserKey.get(testerId) ?? `anon:${testerId}`;
    const name = testerIdToName.get(testerId) ?? "—";
    const entry = curvesByUser.get(userKey) ?? { name, curves: [], projects: new Set<string>() };
    entry.curves.push(...curves);
    for (const projName of testerIdToProjects.get(testerId) ?? new Set<string>()) {
      entry.projects.add(projName);
    }
    curvesByUser.set(userKey, entry);
  }
  const analystCurves: AnalystCapacityCurve[] = Array.from(curvesByUser.entries()).map(([userKey, { name, curves, projects: projSet }]) => ({
    userKey,
    testerName: name,
    curve: sumCurves(curves),
    projects: Array.from(projSet).sort(),
  }));

  // Anexar productiveByPhase a cada analista (Análisis / Diseño / Ejecución).
  // Busca la curva del userKey correspondiente (matcheando por nombre, ya que
  // aggregateOccupationByUser devuelve OccupationResult con testerName).
  const sumBand = (curve: import("./types.js").ProjectOccupationCurve, label: string): number => {
    const band = curve.bands.find((b) => b.label === label);
    if (!band) return 0;
    return Math.round(band.values.reduce((s, v) => s + v, 0) * 100) / 100;
  };
  for (const analyst of analysts) {
    const match = analystCurves.find((c) => c.testerName === analyst.testerName);
    if (!match) continue;
    analyst.productiveByPhase = {
      analysis: sumBand(match.curve, "Análisis"),
      design: sumBand(match.curve, "Diseño de pruebas"),
      execution: sumBand(match.curve, "Ejecución"),
    };
  }

  // Team curve: suma de las curvas de todos los proyectos.
  const teamCurve = sumCurves(projects.map((p) => p.occupationCurve));

  return {
    period,
    periodStart,
    periodEnd,
    periodLabel: periodLabel(period, periodStart, periodEnd),
    clientFilter,
    projects,
    analysts,
    analystCurves,
    teamCurve,
    portfolio: {
      kpis: {
        designed: portD,
        executed: portE,
        defects: portB,
        ratioPct,
        advancePct,
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
