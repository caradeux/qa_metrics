import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildTrendLine } from "../charts/portfolio-charts.js";

export async function addPortfolioTrendSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape((pres as any).shapes.RECTANGLE, { x: 0, y: 0, w: SLIDE.widthIn, h: 0.8, fill: { color: PALETTE.navyUi }, line: { type: "none" } } as any);
  const titleMap = { weekly: "Tendencia diaria del portafolio", monthly: "Tendencia semanal del portafolio", yearly: "Tendencia mensual del portafolio" } as const;
  s.addText(titleMap[spec.period], { x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white });
  const png = await buildTrendLine(spec.portfolio.trend);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
