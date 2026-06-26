import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE } from "../theme.js";
import { slideHeader } from "../components.js";
import { buildTrendLine } from "../charts/portfolio-charts.js";

export async function addPortfolioTrendSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  const titleMap = { weekly: "Tendencia diaria del portafolio", monthly: "Tendencia semanal del portafolio", yearly: "Tendencia mensual del portafolio" } as const;
  slideHeader(pres, s, titleMap[spec.period]);
  const png = await buildTrendLine(spec.portfolio.trend);
  s.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0.4, y: 1.0, w: 12.5, h: 5.6 });
}
