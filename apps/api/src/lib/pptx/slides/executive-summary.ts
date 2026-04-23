import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

function kpiCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  value: string, label: string, accentHex: string,
): void {
  slide.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: PALETTE.white },
    line: { color: accentHex, width: 2 },
    rectRadius: 0.08,
    shadow: { type: "outer", color: "6B7280", opacity: 0.18, offset: 2, blur: 6, angle: 90 },
  } as any);
  slide.addText(value, {
    x, y: y + 0.15, w, h: h * 0.55,
    fontFace: FONT.face, fontSize: 40, bold: true, color: accentHex, align: "center",
  });
  slide.addText(label, {
    x, y: y + h * 0.65, w, h: h * 0.3,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
  });
}

export function addExecutiveSummarySlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.9,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText("Resumen ejecutivo", {
    x: 0.5, y: 0.2, w: 10, h: 0.5,
    fontFace: FONT.face, fontSize: 22, bold: true, color: PALETTE.white,
  });
  s.addText(spec.periodLabel, {
    x: SLIDE.widthIn - 4.5, y: 0.25, w: 4, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight, align: "right",
  });

  // 4 KPI cards.
  const cardW = 2.85;
  const gap = 0.2;
  const startX = (SLIDE.widthIn - (4 * cardW + 3 * gap)) / 2;
  const y = 1.3;
  const k = spec.portfolio.kpis;
  kpiCard(pres, s, startX + 0 * (cardW + gap), y, cardW, 1.7, String(k.designed), "Casos Diseñados", `#${PALETTE.blue}`);
  kpiCard(pres, s, startX + 1 * (cardW + gap), y, cardW, 1.7, String(k.executed), "Casos Ejecutados", `#${PALETTE.greenPrimary}`);
  kpiCard(pres, s, startX + 2 * (cardW + gap), y, cardW, 1.7, String(k.defects), "Defectos Detectados", `#${PALETTE.red}`);
  kpiCard(pres, s, startX + 3 * (cardW + gap), y, cardW, 1.7, `${k.ratioPct}%`, "Ratio Ejec / Dis", `#${PALETTE.cyan}`);

  // Narrativa de regresiones + capacidad.
  const nY = 3.4;
  const mini = [
    { v: String(k.husFirstCycle), l: "HUs completadas en 1ª regresión", color: PALETTE.greenPrimary },
    { v: String(k.husMultipleCycles), l: "HUs con 2+ regresiones (devoluciones de desarrollo)", color: PALETTE.amber },
    { v: `${k.capacityUtilizationPct}%`, l: "Capacidad del equipo utilizada", color: PALETTE.cyan },
  ];
  const miniW = (SLIDE.widthIn - 1.0) / 3;
  mini.forEach((m, i) => {
    const x = 0.5 + i * miniW;
    s.addShape((pres as any).shapes.RECTANGLE, {
      x, y: nY, w: miniW - 0.15, h: 1.3,
      fill: { color: PALETTE.white }, line: { color: m.color, width: 1 },
    } as any);
    s.addText(m.v, {
      x, y: nY + 0.1, w: miniW - 0.15, h: 0.7,
      fontFace: FONT.face, fontSize: 34, bold: true, color: `#${m.color}`, align: "center",
    });
    s.addText(m.l, {
      x, y: nY + 0.82, w: miniW - 0.15, h: 0.45,
      fontFace: FONT.face, fontSize: 11, color: PALETTE.textMuted, align: "center",
    });
  });

  // Footer contextual.
  s.addText(
    `${k.totalProjects} proyectos · ${k.totalAnalysts} analistas · Periodo: ${spec.periodLabel}`,
    { x: 0.5, y: 5.3, w: SLIDE.widthIn - 1, h: 0.4, fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center" },
  );
}
