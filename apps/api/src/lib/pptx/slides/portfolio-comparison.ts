import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, SLIDE } from "../theme.js";
import { slideHeader } from "../components.js";
import { buildComparisonBars } from "../charts/portfolio-charts.js";

export async function addPortfolioComparisonSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  slideHeader(pres, s, "Diseñados vs Ejecutados por proyecto");
  const png = await buildComparisonBars(spec.portfolio.comparison);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
