import PptxGenJSImport from "pptxgenjs";
import type { ReportSpec } from "./types.js";
import { SLIDE } from "./theme.js";
import { addCoverSlide } from "./slides/cover.js";
import { addExecutiveSummarySlide } from "./slides/executive-summary.js";
import { addStatusLegendSlide } from "./slides/status-legend.js";
import { addProjectCoverSlide } from "./slides/project-cover.js";
import { addProjectHuTableSlide } from "./slides/project-hu-table.js";
import { addProjectComplexityMatrixSlide } from "./slides/project-complexity-matrix.js";
import { addPortfolioPipelineSlide } from "./slides/portfolio-pipeline.js";
import { addPortfolioComparisonSlide } from "./slides/portfolio-comparison.js";
import { addPortfolioTrendSlide } from "./slides/portfolio-trend.js";
import { addTeamCapacityCurveSlide } from "./slides/team-capacity-curve.js";
import { addAnalystCapacityCurveSlide } from "./slides/analyst-capacity-curve.js";
import { addAppendixDividerSlide } from "./slides/appendix-divider.js";
import { addAnalystDetailSlide } from "./slides/analyst-detail.js";
import { addClosingSlide } from "./slides/closing.js";
import { addAutomationSummarySlide } from "./slides/automation-summary.js";
import {
  addAutomationProjectCoverSlide,
  addAutomationLinesSlides,
  addAutomationTrendSlide,
} from "./slides/automation-project.js";

// pptxgenjs es CJS: según el loader (node ESM vs tsx/esbuild) el default
// llega como la clase directamente o anidado en `.default`. Normalizamos.
const PptxGenJS: typeof PptxGenJSImport =
  typeof (PptxGenJSImport as any) === "function"
    ? (PptxGenJSImport as any)
    : ((PptxGenJSImport as any).default ?? PptxGenJSImport);

export type ReportDeckKind = "manual" | "automation" | "mixed";

/**
 * Qué deck corresponde según los proyectos del reporte: solo automatización
 * genera un informe propio (scripts y ejecuciones, sin HUs ni capacidad);
 * con ambos tipos se agrega el bloque de automatización al informe QA.
 */
export function reportDeckKind(spec: Pick<ReportSpec, "projects" | "automationProjects">): ReportDeckKind {
  const hasAutomation = (spec.automationProjects?.length ?? 0) > 0;
  if (!hasAutomation) return "manual";
  return spec.projects.length === 0 ? "automation" : "mixed";
}

function newPresentation(title: string) {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "INOVABIZ_WIDE", width: SLIDE.widthIn, height: SLIDE.heightIn });
  pres.layout = "INOVABIZ_WIDE";
  pres.author = "Inovabiz";
  pres.company = "Inovabiz";
  pres.title = title;
  return pres;
}

async function addAutomationBlock(pres: InstanceType<typeof PptxGenJS>, spec: ReportSpec): Promise<void> {
  addAutomationSummarySlide(pres, spec);
  for (const p of spec.automationProjects) {
    addAutomationProjectCoverSlide(pres, p);
    addAutomationLinesSlides(pres, p);
    await addAutomationTrendSlide(pres, p, spec.period);
  }
}

export async function buildReportPptx(spec: ReportSpec): Promise<Buffer> {
  const kind = reportDeckKind(spec);

  if (kind === "automation") {
    const pres = newPresentation(`Informe de Automatización QA — ${spec.periodLabel}`);
    addCoverSlide(pres, spec, { title: "Informe de Automatización QA" });
    await addAutomationBlock(pres, spec);
    addClosingSlide(pres);
    return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  }

  const pres = newPresentation(`Informe QA — ${spec.periodLabel}`);

  // Bloque A
  addCoverSlide(pres, spec);
  addExecutiveSummarySlide(pres, spec);
  addStatusLegendSlide(pres);

  // Bloque B — por proyecto (cover + HU table + matriz; ya NO curva por proyecto)
  for (const p of spec.projects) {
    addProjectCoverSlide(pres, p);
    addProjectHuTableSlide(pres, p);
    addProjectComplexityMatrixSlide(pres, p);
  }

  // Bloque C — portfolio + curva de equipo consolidada
  if (spec.projects.length > 0) {
    addPortfolioPipelineSlide(pres, spec);
    await addPortfolioComparisonSlide(pres, spec);
    await addPortfolioTrendSlide(pres, spec);
    await addTeamCapacityCurveSlide(pres, spec);
  }

  // Bloque C2 — automatización, cuando el alcance mezcla ambos tipos de proyecto
  if (kind === "mixed") await addAutomationBlock(pres, spec);

  // Bloque D — anexo interno: por cada analista, curva + detalle tabular
  if (spec.includeInternalAppendix && spec.analysts.length > 0) {
    addAppendixDividerSlide(pres);
    // Índice testerId/userKey → curva agrupada por usuario
    const curveByUserKey = new Map(spec.analystCurves.map((c) => [c.userKey, c]));
    for (const a of spec.analysts) {
      // Resolver userKey del analista (via testerId → userId fue hecho en report-data;
      // aquí necesitamos el mismo mapping). Se hace directo por testerId como fallback.
      const matchByName = spec.analystCurves.find((c) => c.testerName === a.testerName);
      const curve = matchByName ?? curveByUserKey.get(`anon:${a.testerId}`);
      if (curve) {
        await addAnalystCapacityCurveSlide(pres, curve);
      }
      addAnalystDetailSlide(pres, a);
    }
  }

  addClosingSlide(pres);

  const nodeBuffer = await pres.write({ outputType: "nodebuffer" });
  return nodeBuffer as Buffer;
}
