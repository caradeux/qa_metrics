import type PptxGenJS from "pptxgenjs";
import type { ReportSpec, OccupationBandLabel } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildOccupationChart } from "../charts/occupation-chart.js";

const MEANINGFUL_BANDS: OccupationBandLabel[] = [
  "Análisis",
  "Diseño de pruebas",
  "Ejecución",
  "Reunión con usuario",
  "Reunión con desarrollo",
  "Inducción/Capacitación",
  "Esperando aprobación cliente",
  "En manos de desarrollo",
];

export async function addTeamCapacityCurveSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const meaningfulHours = spec.teamCurve.bands
    .filter((b) => MEANINGFUL_BANDS.includes(b.label))
    .reduce((sum, b) => sum + b.values.reduce((a, v) => a + v, 0), 0);
  if (meaningfulHours === 0) return;

  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText("Capacidad ocupada del equipo — consolidado del periodo", {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const png = await buildOccupationChart(spec.teamCurve, "Equipo");
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 12.5, h: 6.0 });
}
