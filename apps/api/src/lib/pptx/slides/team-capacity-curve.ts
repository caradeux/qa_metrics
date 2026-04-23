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

function formatHours(h: number): string {
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function utilColor(pct: number, overallocated: boolean): string {
  if (overallocated) return PALETTE.red;
  if (pct >= 80) return PALETTE.greenPrimary;
  if (pct >= 50) return PALETTE.amber;
  return PALETTE.red;
}

export async function addTeamCapacityCurveSlide(pres: PptxGenJS, spec: ReportSpec): Promise<void> {
  const meaningfulHours = spec.teamCurve.bands
    .filter((b) => MEANINGFUL_BANDS.includes(b.label))
    .reduce((sum, b) => sum + b.values.reduce((a, v) => a + v, 0), 0);
  if (meaningfulHours === 0) return;

  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText("Capacidad ocupada del equipo", {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 5, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });
  s.addText("Dashboard de utilización por persona + curva consolidada", {
    x: SLIDE.widthIn - 5.2, y: 0.26, w: 4.7, h: 0.4,
    fontFace: FONT.face, fontSize: 11, color: PALETTE.greenLight, align: "right",
  });

  // Summary strip (totales del equipo)
  const totalCap = spec.analysts.reduce((s, a) => s + a.capacityHours, 0);
  const totalAct = spec.analysts.reduce((s, a) => s + a.activityHours, 0);
  const totalProd = spec.analysts.reduce((s, a) => s + a.productiveHoursEstimate, 0);
  const totalAbsence = spec.analysts.reduce((s, a) => s + a.absenceHours, 0);
  const avgUtil = spec.analysts.length > 0
    ? Math.round(spec.analysts.reduce((s, a) => s + a.occupationPct, 0) / spec.analysts.length)
    : 0;

  const stripY = 0.9;
  const stripH = 0.55;
  const chips = [
    { label: "Equipo", value: `${spec.analysts.length} analista${spec.analysts.length !== 1 ? "s" : ""}`, color: PALETTE.blue },
    { label: "Capacidad efectiva", value: formatHours(totalCap), color: PALETTE.blue },
    { label: "Ausencias", value: formatHours(totalAbsence), color: PALETTE.amber },
    { label: "Reuniones / Actividad", value: formatHours(totalAct), color: PALETTE.purple },
    { label: "Productivo QA", value: formatHours(totalProd), color: PALETTE.greenPrimary },
    { label: "Utilización promedio", value: `${avgUtil}%`, color: PALETTE.cyan },
  ];
  const chipW = (SLIDE.widthIn - 1) / chips.length;
  chips.forEach((c, i) => {
    const x = 0.5 + i * chipW;
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: x + 0.05, y: stripY, w: chipW - 0.1, h: stripH,
      fill: { color: PALETTE.white },
      line: { color: c.color, width: 1 },
      rectRadius: 0.05,
    } as any);
    s.addText(c.value, {
      x: x + 0.05, y: stripY + 0.02, w: chipW - 0.1, h: 0.3,
      fontFace: FONT.face, fontSize: 14, bold: true, color: `#${c.color}`, align: "center",
    });
    s.addText(c.label, {
      x: x + 0.05, y: stripY + 0.3, w: chipW - 0.1, h: 0.22,
      fontFace: FONT.face, fontSize: 8, color: PALETTE.textMuted, align: "center",
    });
  });

  // Cards por tester
  const cardsY = stripY + stripH + 0.15;
  const cardsH = 1.3;
  const cardsRowW = SLIDE.widthIn - 1;
  const nAnalysts = spec.analysts.length;
  const cardsPerRow = Math.min(nAnalysts, Math.max(3, Math.min(6, nAnalysts)));
  const cardGap = 0.15;
  const cardW = Math.max(1.8, (cardsRowW - cardGap * (cardsPerRow - 1)) / cardsPerRow);

  spec.analysts.forEach((a, i) => {
    if (i >= cardsPerRow) return; // solo una fila para no chocar con el chart (MVP)
    const x = 0.5 + i * (cardW + cardGap);
    const pct = Math.round(a.occupationPct);
    const color = utilColor(pct, a.overallocated);

    // Card container
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x, y: cardsY, w: cardW, h: cardsH,
      fill: { color: PALETTE.white },
      line: { color: "E5E7EB", width: 0.5 },
      rectRadius: 0.07,
      shadow: { type: "outer", color: "6B7280", opacity: 0.15, offset: 2, blur: 5, angle: 90 },
    } as any);
    // Name
    s.addText(a.testerName, {
      x: x + 0.1, y: cardsY + 0.07, w: cardW - 0.2, h: 0.3,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary,
    });
    // Utilization %
    s.addText(`${pct}%`, {
      x: x + 0.1, y: cardsY + 0.35, w: cardW - 0.2, h: 0.45,
      fontFace: FONT.face, fontSize: 26, bold: true, color: `#${color}`,
    });
    // Mini horizontal progress bar
    const barY = cardsY + 0.82;
    const barW = cardW - 0.2;
    const barH = 0.12;
    s.addShape((pres as any).shapes.RECTANGLE, {
      x: x + 0.1, y: barY, w: barW, h: barH,
      fill: { color: "E5E7EB" }, line: { type: "none" },
    } as any);
    const fillW = Math.max(0, Math.min(1, pct / 100)) * barW;
    if (fillW > 0) {
      s.addShape((pres as any).shapes.RECTANGLE, {
        x: x + 0.1, y: barY, w: fillW, h: barH,
        fill: { color }, line: { type: "none" },
      } as any);
    }
    // Subtitle: horas
    s.addText(
      `${formatHours(a.activityHours + a.productiveHoursEstimate)} / ${formatHours(a.capacityHours)} efectivas${a.absenceHours > 0 ? ` · ${formatHours(a.absenceHours)} ausencia` : ""}`,
      {
        x: x + 0.1, y: cardsY + 1.0, w: cardW - 0.2, h: 0.25,
        fontFace: FONT.face, fontSize: 8, color: PALETTE.textMuted,
      },
    );
    if (a.overallocated) {
      s.addText("⚠ sobre-asignado", {
        x: x + 0.1, y: cardsY + 1.2, w: cardW - 0.2, h: 0.15,
        fontFace: FONT.face, fontSize: 7, bold: true, color: PALETTE.red,
      });
    }
  });

  // Curva consolidada debajo
  const chartY = cardsY + cardsH + 0.2;
  const chartH = SLIDE.heightIn - chartY - 0.3;
  const png = await buildOccupationChart(spec.teamCurve, "Equipo");
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: chartY, w: 12.5, h: chartH });
}
