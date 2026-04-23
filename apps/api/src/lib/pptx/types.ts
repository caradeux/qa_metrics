import type { OccupationResult } from "../occupation.js";

export type ReportPeriod = "weekly" | "monthly" | "yearly";

export type ComplexityLevel = "LOW" | "MEDIUM" | "HIGH";

export interface HuRow {
  storyId: string;
  externalId: string | null;
  title: string;
  regressionNumber: number;       // story.cycles.length
  designComplexity: ComplexityLevel;
  executionComplexity: ComplexityLevel;
  status: string;                  // AssignmentStatus interno
  statusLabel: string;             // "En Diseño", "En Curso", etc.
  designed: number;
  executed: number;
  defects: number;
  trainingHours: number;           // horas de Inducción/Capacitación imputadas a esta HU
  userMeetingHours: number;        // horas de "Reunión con usuario" imputadas
  devMeetingHours: number;         // horas de "Reunión con desarrollo" imputadas
}

export interface ComplexityBubble {
  storyId: string;
  title: string;
  designComplexity: ComplexityLevel;
  executionComplexity: ComplexityLevel;
  size: number;                    // designed + executed del periodo
  statusLabel: string;
}

export type OccupationBandLabel =
  | "Análisis"
  | "Diseño de pruebas"
  | "Ejecución"
  | "Reunión con usuario"
  | "Reunión con desarrollo"
  | "Inducción/Capacitación"
  | "Esperando aprobación cliente"
  | "En manos de desarrollo"
  | "Detenido"
  | "No iniciado"
  | "Productivas no imputadas";

export interface OccupationBand {
  label: OccupationBandLabel;
  colorHex: string;
  values: number[];                // uno por bucket
}

export interface OccupationBucket {
  label: string;                   // "Lun", "Sem 15", "Abr", etc.
  capacityHours: number;           // guía superior
}

export interface ProjectOccupationCurve {
  buckets: OccupationBucket[];
  bands: OccupationBand[];
}

export interface ProjectPipeline {
  label: string;                   // "En Diseño", etc.
  count: number;
  colorHex: string;
}

export interface ProjectReportData {
  projectId: string;
  projectName: string;
  clientName: string;
  projectManagerName: string | null;
  testers: Array<{ id: string; name: string; allocation: number }>;
  kpis: {
    designed: number;
    executed: number;
    defects: number;
  };
  pipeline: ProjectPipeline[];
  hus: HuRow[];
  complexityBubbles: ComplexityBubble[];
  occupationCurve: ProjectOccupationCurve;
}

export interface PortfolioKpis {
  designed: number;
  executed: number;
  defects: number;
  ratioPct: number;               // legacy, se mantiene por compatibilidad de tipos
  advancePct: number;             // % HUs que alcanzaron EXECUTION+ (reemplazo del Ratio en UI)
  husFirstCycle: number;
  husMultipleCycles: number;
  capacityUtilizationPct: number;
  totalProjects: number;
  totalAnalysts: number;
}

export interface PortfolioTrendPoint {
  label: string;                   // "Lun 15", "Sem 15", "Abr", etc.
  designed: number;
  executed: number;
  defects: number;
}

export interface ReportSpec {
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;             // "Semana del 15 al 19 abr 2026" | "Abril 2026" | "Año 2026"
  clientFilter: { id: string; name: string } | null;
  projects: ProjectReportData[];
  analysts: OccupationResult[];    // reutiliza tipo existente de occupation.ts
  portfolio: {
    kpis: PortfolioKpis;
    pipeline: ProjectPipeline[];
    comparison: Array<{ projectName: string; designed: number; executed: number }>;
    trend: PortfolioTrendPoint[];
  };
  includeInternalAppendix: boolean; // false para CLIENT_PM, true para el resto
}
