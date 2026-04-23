import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildComparisonBars } from "../charts/portfolio-charts.js";

export async function addPortfolioComparisonSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape((pres as any).shapes.RECTANGLE, { x: 0, y: 0, w: SLIDE.widthIn, h: 0.8, fill: { color: PALETTE.navyUi }, line: { type: "none" } } as any);
  s.addText("Diseñados vs Ejecutados por proyecto", { x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white });
  const png = await buildComparisonBars(spec.portfolio.comparison);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
