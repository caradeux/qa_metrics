import PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "./types.js";
import { SLIDE } from "./theme.js";
import { addCoverSlide } from "./slides/cover.js";
import { addExecutiveSummarySlide } from "./slides/executive-summary.js";
import { addProjectCoverSlide } from "./slides/project-cover.js";
import { addProjectHuTableSlide } from "./slides/project-hu-table.js";
import { addProjectOccupationCurveSlide } from "./slides/project-occupation-curve.js";
import { addProjectComplexityMatrixSlide } from "./slides/project-complexity-matrix.js";
import { addPortfolioPipelineSlide } from "./slides/portfolio-pipeline.js";
import { addPortfolioComparisonSlide } from "./slides/portfolio-comparison.js";
import { addPortfolioTrendSlide } from "./slides/portfolio-trend.js";
import { addAppendixDividerSlide } from "./slides/appendix-divider.js";
import { addAnalystDetailSlide } from "./slides/analyst-detail.js";
import { addClosingSlide } from "./slides/closing.js";

export async function buildReportPptx(spec: ReportSpec): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "INOVABIZ_WIDE", width: SLIDE.widthIn, height: SLIDE.heightIn });
  pres.layout = "INOVABIZ_WIDE";
  pres.author = "Inovabiz";
  pres.company = "Inovabiz";
  pres.title = `Informe QA — ${spec.periodLabel}`;

  // Bloque A
  addCoverSlide(pres, spec);
  addExecutiveSummarySlide(pres, spec);

  // Bloque B — por proyecto
  for (const p of spec.projects) {
    addProjectCoverSlide(pres, p);
    addProjectHuTableSlide(pres, p);
    await addProjectOccupationCurveSlide(pres, p);
    await addProjectComplexityMatrixSlide(pres, p);
  }

  // Bloque C — portfolio
  if (spec.projects.length > 0) {
    await addPortfolioPipelineSlide(pres, spec);
    await addPortfolioComparisonSlide(pres, spec);
    await addPortfolioTrendSlide(pres, spec);
  }

  // Bloque D — anexo interno
  if (spec.includeInternalAppendix && spec.analysts.length > 0) {
    addAppendixDividerSlide(pres);
    for (const a of spec.analysts) {
      addAnalystDetailSlide(pres, a);
    }
  }

  addClosingSlide(pres);

  const nodeBuffer = await pres.write({ outputType: "nodebuffer" });
  return nodeBuffer as Buffer;
}
