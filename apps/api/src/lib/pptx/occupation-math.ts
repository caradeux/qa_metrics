/**
 * Capacidad diaria de un tester en horas.
 * - 0 en fin de semana o feriado.
 * - 8h × (allocation/100) en día hábil.
 *
 * @param day  Fecha (se considera la parte de día UTC)
 * @param allocation  Porcentaje 0-100
 * @param holidaysMs  Set con timestamps ms (getTime()) de feriados en UTC medianoche
 */
export function dailyCapacityHours(
  day: Date,
  allocation: number,
  holidaysMs: Set<number>,
): number {
  const dow = day.getUTCDay();
  if (dow === 0 || dow === 6) return 0;
  const dayStartMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  if (holidaysMs.has(dayStartMs)) return 0;
  return 8 * (allocation / 100);
}

import type { AssignmentPhaseType } from "@qa-metrics/database";

export interface PhaseRef {
  type: AssignmentPhaseType;
  projectId: string;
}

export interface SplitResult {
  projectHours: number;
  byPhase: Record<AssignmentPhaseType, number>;
}

/**
 * Reparte `productiveHours` de un tester entre las fases activas,
 * devolviendo solo la porción que corresponde al `targetProjectId`.
 *
 * Fórmula spec §5.1 Paso 4:
 *   share_P = #phasesActivas(t, d, P) / #phasesActivas(t, d, *)
 *   horasFase(t, d, fase, P) = productive × share_P × (#phases_P_tipo_fase / #phases_P)
 */
export function splitProductiveHoursAcrossPhases(
  productiveHours: number,
  phases: readonly PhaseRef[],
  targetProjectId: string,
): SplitResult {
  const empty: Record<AssignmentPhaseType, number> = {
    ANALYSIS: 0,
    TEST_DESIGN: 0,
    EXECUTION: 0,
  };
  if (productiveHours <= 0 || phases.length === 0) {
    return { projectHours: 0, byPhase: empty };
  }
  const inProject = phases.filter((p) => p.projectId === targetProjectId);
  if (inProject.length === 0) {
    return { projectHours: 0, byPhase: empty };
  }
  const projectHours = productiveHours * (inProject.length / phases.length);
  const byPhase: Record<AssignmentPhaseType, number> = { ...empty };
  for (const p of inProject) {
    byPhase[p.type] += projectHours / inProject.length;
  }
  return { projectHours, byPhase };
}

export interface TransversalInput {
  activityHours: number;
  assignmentProjectId: string | null;   // null = transversal
  phasesByProject: Record<string, number>; // conteo de phases activas por proyecto ese día
  testerProjectIds: readonly string[];   // proyectos en los que el tester tiene Tester activo
  targetProjectId: string;
}

export function splitTransversalActivityHours(input: TransversalInput): number {
  const {
    activityHours,
    assignmentProjectId,
    phasesByProject,
    testerProjectIds,
    targetProjectId,
  } = input;

  if (activityHours <= 0) return 0;

  // Caso 1: Activity vinculada a un assignment de un proyecto específico.
  if (assignmentProjectId !== null) {
    return assignmentProjectId === targetProjectId ? activityHours : 0;
  }

  // Caso 2: Activity transversal (sin assignment).
  const totalPhases = Object.values(phasesByProject).reduce((s, n) => s + n, 0);
  if (totalPhases > 0) {
    const phasesInTarget = phasesByProject[targetProjectId] ?? 0;
    return activityHours * (phasesInTarget / totalPhases);
  }

  // Sin phases → reparto equitativo entre proyectos donde el tester está activo.
  if (!testerProjectIds.includes(targetProjectId)) return 0;
  return activityHours / testerProjectIds.length;
}

import type { ProjectOccupationCurve, OccupationBand, OccupationBucket, OccupationBandLabel } from "./types.js";
import { PALETTE } from "./theme.js";

export type BucketingMode = "daily" | "weekly" | "monthly";

export interface TesterRef {
  id: string;
  allocation: number;
  projectIdsActive: readonly string[];
}

export interface PhaseSegment {
  testerId: string;
  projectId: string;
  type: AssignmentPhaseType;
  start: Date;
  end: Date;
}

export interface ActivityRef {
  testerId: string;
  categoryName: string;             // exacto: "Reunión con usuario", "Reunión con desarrollo", "Inducción", "Capacitación"
  assignmentProjectId: string | null;
  start: Date;
  end: Date;
}

export interface DailyRecordRef {
  testerId: string;
  date: Date;                       // fecha (se compara por parte de día UTC)
  projectId: string;
  designed: number;
  executed: number;
  defects: number;
}

export interface AssignmentInfo {
  testerId: string;
  projectId: string;
  status: string;                   // AssignmentStatus (string para no acoplar con Prisma enum)
}

export interface AggregateInput {
  projectId: string;
  from: Date;
  to: Date;
  bucketing: BucketingMode;
  testers: readonly TesterRef[];
  phaseSegments: readonly PhaseSegment[];
  activities: readonly ActivityRef[];
  holidaysMs: Set<number>;
  dailyRecords?: readonly DailyRecordRef[]; // fallback cuando no hay AssignmentPhase
  assignments?: readonly AssignmentInfo[];  // para clasificar por status cuando no hay DailyRecord ni phase
  // Fecha de corte: días estrictamente posteriores a asOfDate (por fecha UTC)
  // se excluyen del cálculo y la gráfica. Evita dibujar días que aún no han
  // ocurrido (que aparecerían como capacidad sin imputar).
  asOfDate?: Date;
}

const BAND_ORDER = [
  "Análisis",
  "Diseño de pruebas",
  "Ejecución",
  "Reunión con usuario",
  "Reunión con desarrollo",
  "Inducción/Capacitación",
  "Esperando aprobación cliente",
  "En manos de desarrollo",
  "Detenido",
  "No iniciado",
  "Productivas no imputadas",
] as const satisfies readonly OccupationBandLabel[];

const BAND_COLORS: Record<OccupationBandLabel, string> = {
  "Análisis": PALETTE.phaseAnalysis,
  "Diseño de pruebas": PALETTE.phaseDesign,
  "Ejecución": PALETTE.phaseExecution,
  "Reunión con usuario": PALETTE.activityUserMeeting,
  "Reunión con desarrollo": PALETTE.activityDevMeeting,
  "Inducción/Capacitación": PALETTE.activityInduction,
  "Esperando aprobación cliente": PALETTE.waitingClient,
  "En manos de desarrollo": PALETTE.onDev,
  "Detenido": PALETTE.onHold,
  "No iniciado": PALETTE.notStarted,
  "Productivas no imputadas": PALETTE.activityUnassigned,
};

// Mapa de AssignmentStatus → banda cuando NO hay DailyRecord ni AssignmentPhase activa.
const STATUS_BAND_MAP: Record<string, OccupationBandLabel | null> = {
  REGISTERED: "No iniciado",
  ANALYSIS: null,                   // clasifica por fase (activo)
  TEST_DESIGN: null,                // clasifica por fase (activo)
  EXECUTION: null,                  // clasifica por fase (activo)
  WAITING_QA_DEPLOY: "En manos de desarrollo",
  RETURNED_TO_DEV: "En manos de desarrollo",
  WAITING_UAT: "Esperando aprobación cliente",
  UAT: "Esperando aprobación cliente",
  PRODUCTION: null,                 // no consume capacidad
  ON_HOLD: "Detenido",
};

const ACTIVITY_BAND_MAP: Record<string, OccupationBandLabel> = {
  "Reunión con usuario": "Reunión con usuario",
  "Reunión con desarrollo": "Reunión con desarrollo",
  "Inducción": "Inducción/Capacitación",
  "Capacitación": "Inducción/Capacitación",
};

function iterDays(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const endMs = to.getTime();
  while (cur.getTime() <= endMs) {
    out.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function bucketKey(day: Date, mode: BucketingMode): string {
  if (mode === "daily") return day.toISOString().slice(0, 10);
  if (mode === "weekly") {
    // lunes ISO
    const d = new Date(day.getTime());
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow - 1));
    return d.toISOString().slice(0, 10);
  }
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(key: string, mode: BucketingMode): string {
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (mode === "daily") {
    const d = new Date(`${key}T00:00:00Z`);
    const dow = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
    return `${dayNames[dow]} ${d.getUTCDate()}`;
  }
  if (mode === "weekly") {
    const d = new Date(`${key}T00:00:00Z`);
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getUTCDay() + 1) / 7);
    return `Sem ${isoWeek}`;
  }
  const [, m] = key.split("-");
  return monthNames[Number(m) - 1]!;
}

function hoursOverlapDay(start: Date, end: Date, day: Date): number {
  const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const a = Math.max(start.getTime(), dayStart);
  const b = Math.min(end.getTime(), dayEnd);
  if (b <= a) return 0;
  return (b - a) / 3600000;
}

function dateInSegment(seg: PhaseSegment, day: Date): boolean {
  const ds = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const de = ds + 24 * 3600 * 1000 - 1;
  return seg.start.getTime() <= de && seg.end.getTime() >= ds;
}

function inferPhaseFromDailyRecord(r: DailyRecordRef): AssignmentPhaseType {
  if (r.executed > 0) return "EXECUTION";
  if (r.designed > 0) return "TEST_DESIGN";
  // Defects o cargas sin números concretos → asumimos ejecución (estaba probando).
  return "EXECUTION";
}

// Categorías cuyo significado es "no trabajó" (resta capacidad en lugar de ocupar una banda).
const ABSENCE_CATEGORIES = new Set([
  "vacaciones",
  "ausencia",
  "licencia",
  "licencia médica",
  "licencia medica",
  "permiso",
  "feriado",
  "día administrativo",
  "dia administrativo",
]);

export function isAbsenceCategory(name: string): boolean {
  return ABSENCE_CATEGORIES.has(name.trim().toLowerCase());
}

function sameUTCDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export function aggregateOccupationCurve(input: AggregateInput): ProjectOccupationCurve {
  const { projectId, from, to, bucketing, testers, phaseSegments, activities, holidaysMs, dailyRecords = [], assignments = [], asOfDate } = input;
  const cutoffMs = asOfDate
    ? Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()) + 24 * 3600 * 1000 - 1
    : Infinity;
  const days = iterDays(from, to).filter((d) => {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    return d.getTime() <= cutoffMs;
  });

  // Orden de buckets estable.
  const bucketKeys: string[] = [];
  const seen = new Set<string>();
  for (const d of days) {
    const k = bucketKey(d, bucketing);
    if (!seen.has(k)) { seen.add(k); bucketKeys.push(k); }
  }

  // Acumuladores.
  const bandTotals: Record<OccupationBandLabel, Record<string, number>> = Object.fromEntries(
    BAND_ORDER.map((b) => [b, Object.fromEntries(bucketKeys.map((k) => [k, 0]))]),
  ) as Record<OccupationBandLabel, Record<string, number>>;
  const capacityByBucket: Record<string, number> = Object.fromEntries(bucketKeys.map((k) => [k, 0]));

  for (const day of days) {
    const bKey = bucketKey(day, bucketing);

    for (const t of testers) {
      const nominalCap = dailyCapacityHours(day, t.allocation, holidaysMs);
      if (nominalCap === 0) continue;

      // Restar horas de ausencia (vacaciones, licencias, permisos) de la capacidad.
      let absenceHoursToday = 0;
      for (const a of activities) {
        if (a.testerId !== t.id) continue;
        if (!isAbsenceCategory(a.categoryName)) continue;
        absenceHoursToday += hoursOverlapDay(a.start, a.end, day);
      }
      const cap = Math.max(0, nominalCap - absenceHoursToday);
      if (cap === 0) continue;
      capacityByBucket[bKey]! += cap;

      // Phases activas del tester ese día (cualquier proyecto).
      const activePhases: PhaseRef[] = phaseSegments
        .filter((s) => s.testerId === t.id && dateInSegment(s, day))
        .map((s) => ({ type: s.type, projectId: s.projectId }));

      // Fallback: si no hay AssignmentPhase modeladas, usar DailyRecord como evidencia
      // de trabajo productivo del tester ese día e inferir la fase desde los números.
      if (activePhases.length === 0 && dailyRecords.length > 0) {
        for (const r of dailyRecords) {
          if (r.testerId !== t.id) continue;
          if (!sameUTCDay(r.date, day)) continue;
          activePhases.push({
            type: inferPhaseFromDailyRecord(r),
            projectId: r.projectId,
          });
        }
      }

      const phasesByProject: Record<string, number> = {};
      for (const p of activePhases) {
        phasesByProject[p.projectId] = (phasesByProject[p.projectId] ?? 0) + 1;
      }

      // Activity hours del tester ese día.
      let totalActivityHoursAllProjects = 0;
      const activityHoursByBand: Record<OccupationBandLabel, number> = {
        "Análisis": 0, "Diseño de pruebas": 0, "Ejecución": 0,
        "Reunión con usuario": 0, "Reunión con desarrollo": 0,
        "Inducción/Capacitación": 0,
        "Esperando aprobación cliente": 0, "En manos de desarrollo": 0,
        "Detenido": 0, "No iniciado": 0,
        "Productivas no imputadas": 0,
      };

      for (const a of activities) {
        if (a.testerId !== t.id) continue;
        // Ausencias ya restaron capacidad; no suman a ninguna banda.
        if (isAbsenceCategory(a.categoryName)) continue;
        const hrs = hoursOverlapDay(a.start, a.end, day);
        if (hrs === 0) continue;
        totalActivityHoursAllProjects += hrs;
        const toProject = splitTransversalActivityHours({
          activityHours: hrs,
          assignmentProjectId: a.assignmentProjectId,
          phasesByProject,
          testerProjectIds: t.projectIdsActive,
          targetProjectId: projectId,
        });
        const bandLabel = ACTIVITY_BAND_MAP[a.categoryName];
        if (bandLabel) activityHoursByBand[bandLabel] += toProject;
      }

      // Horas productivas globales y reparto a fases del proyecto.
      const productive = Math.max(0, cap - totalActivityHoursAllProjects);
      const split = splitProductiveHoursAcrossPhases(
        productive,
        activePhases,
        projectId,
      );

      // Sumar bandas Activity al bucket.
      for (const [label, h] of Object.entries(activityHoursByBand)) {
        bandTotals[label as OccupationBandLabel][bKey]! += h;
      }

      // Sumar bandas de fase.
      bandTotals["Análisis"][bKey]! += split.byPhase.ANALYSIS;
      bandTotals["Diseño de pruebas"][bKey]! += split.byPhase.TEST_DESIGN;
      bandTotals["Ejecución"][bKey]! += split.byPhase.EXECUTION;

      // Cuando el tester no tiene fases activas EN NINGÚN proyecto y tampoco
      // DailyRecord, clasificamos sus horas productivas según los assignments
      // del tester en ESTE proyecto. Si están en estados de dependencia
      // externa, las horas van a bandas específicas; si no, al fallback gris.
      const phasesInP = phasesByProject[projectId] ?? 0;
      const phasesInOtherProjects = Object.entries(phasesByProject)
        .filter(([k]) => k !== projectId)
        .reduce((s, [, n]) => s + n, 0);

      if (t.projectIdsActive.includes(projectId) && phasesInP === 0 && phasesInOtherProjects === 0 && productive > 0) {
        const myAssignments = assignments.filter(
          (a) => a.testerId === t.id && a.projectId === projectId,
        );
        // Mapear cada assignment a una banda según su estado. null = activo sin fase,
        // se trata como productivas no imputadas (el tester debería estar
        // trabajando pero no hay evidencia).
        const bandCounts: Partial<Record<OccupationBandLabel, number>> = {};
        let unimputedCount = 0;
        let productionCount = 0;
        for (const a of myAssignments) {
          const band = STATUS_BAND_MAP[a.status];
          if (band === undefined) continue;
          if (a.status === "PRODUCTION") { productionCount++; continue; }
          if (band === null) { unimputedCount++; continue; }
          bandCounts[band] = (bandCounts[band] ?? 0) + 1;
        }
        const totalClassified = Object.values(bandCounts).reduce((s, n) => s + (n ?? 0), 0) + unimputedCount;
        if (totalClassified === 0) {
          // Sin assignments o todos en PRODUCTION → productivas no imputadas
          bandTotals["Productivas no imputadas"][bKey]! += productive;
        } else {
          for (const [label, n] of Object.entries(bandCounts)) {
            if (!n) continue;
            bandTotals[label as OccupationBandLabel][bKey]! += productive * (n / totalClassified);
          }
          if (unimputedCount > 0) {
            bandTotals["Productivas no imputadas"][bKey]! += productive * (unimputedCount / totalClassified);
          }
        }
        // productionCount es solo para evitar "sin assignments" cuando hay producción
        void productionCount;
      }
    }
  }

  const buckets: OccupationBucket[] = bucketKeys.map((k) => ({
    label: bucketLabel(k, bucketing),
    capacityHours: Math.round((capacityByBucket[k] ?? 0) * 100) / 100,
  }));

  const bands: OccupationBand[] = BAND_ORDER.map((label) => ({
    label,
    colorHex: BAND_COLORS[label],
    values: bucketKeys.map((k) => Math.round((bandTotals[label]![k] ?? 0) * 100) / 100),
  }));

  return { buckets, bands };
}
