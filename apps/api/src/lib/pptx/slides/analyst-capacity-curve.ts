import type PptxGenJS from "pptxgenjs";
import type { AnalystCapacityCurve, OccupationBandLabel } from "../types.js";
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

export async function addAnalystCapacityCurveSlide(
  pres: PptxGenJS,
  a: AnalystCapacityCurve,
): Promise<void> {
  const meaningfulHours = a.curve.bands
    .filter((b) => MEANINGFUL_BANDS.includes(b.label))
    .reduce((sum, b) => sum + b.values.reduce((acc, v) => acc + v, 0), 0);
  if (meaningfulHours === 0 && a.curve.buckets.every((b) => b.capacityHours === 0)) return;

  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Capacidad ocupada — ${a.testerName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 5, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });
  if (a.projects.length > 0) {
    s.addText(`Proyectos: ${a.projects.join(" · ")}`, {
      x: SLIDE.widthIn - 5.2, y: 0.25, w: 4.7, h: 0.4,
      fontFace: FONT.face, fontSize: 11, color: PALETTE.greenLight, align: "right",
    });
  }

  const png = await buildOccupationChart(a.curve, a.testerName);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 12.5, h: 6.0 });
}
