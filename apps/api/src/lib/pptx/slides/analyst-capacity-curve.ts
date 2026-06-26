import type PptxGenJS from "pptxgenjs";
import type { AnalystCapacityCurve, OccupationBandLabel } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { slideHeader } from "../components.js";
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

  slideHeader(
    pres, s, `Capacidad ocupada — ${a.testerName}`,
    a.projects.length > 0 ? { rightText: `Proyectos: ${a.projects.join(" · ")}` } : undefined,
  );

  const png = await buildOccupationChart(a.curve, a.testerName);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 12.5, h: 6.0 });
}
