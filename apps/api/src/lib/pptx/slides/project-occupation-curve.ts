import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData, OccupationBandLabel } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildOccupationChart } from "../charts/occupation-chart.js";

// Bandas que "valen la pena" mostrar. Si todas las bandas meaningful están
// en 0 (ej. proyecto 100% en estado "No iniciado"), la slide no aporta valor
// y se omite. "Productivas no imputadas", "No iniciado" y "Detenido" no
// cuentan como actividad real.
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

export async function addProjectOccupationCurveSlide(pres: PptxGenJS, p: ProjectReportData): Promise<void> {
  const meaningfulHours = p.occupationCurve.bands
    .filter((b) => MEANINGFUL_BANDS.includes(b.label))
    .reduce((sum, b) => sum + b.values.reduce((a, v) => a + v, 0), 0);
  if (meaningfulHours === 0) {
    // Proyecto sin actividad real (todo No iniciado, Detenido o sin datos).
    // Omitimos la slide para no generar ruido.
    return;
  }

  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Capacidad ocupada — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const png = await buildOccupationChart(p.occupationCurve, p.projectName);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 12.5, h: 6.0 });
}
