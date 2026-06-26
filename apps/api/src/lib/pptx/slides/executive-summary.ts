import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { slideHeader, statCard } from "../components.js";

export function addExecutiveSummarySlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  slideHeader(pres, s, "Resumen ejecutivo", { rightText: spec.periodLabel });

  const k = spec.portfolio.kpis;

  // Grilla simétrica 3×2: producción arriba, calidad/capacidad abajo.
  const gap = 0.3;
  const m = 0.7;
  const card3W = (SLIDE.widthIn - 2 * m - 2 * gap) / 3;

  // ── Fila 1: 3 KPIs de producción ──
  const y1 = 1.4;
  const h1 = 2.0;
  const top = [
    { v: String(k.designed), l: "Casos Diseñados", c: PALETTE.blue },
    { v: String(k.executed), l: "Casos Ejecutados", c: PALETTE.greenPrimary },
    { v: String(k.defects), l: "Defectos Detectados", c: PALETTE.red },
  ];
  top.forEach((c, i) => {
    statCard(pres, s, { x: m + i * (card3W + gap), y: y1, w: card3W, h: h1, value: c.v, label: c.l, accent: c.c });
  });

  // ── Fila 2: 3 indicadores de calidad/capacidad ──
  const y2 = 3.8;
  const h2 = 1.9;
  const bottom = [
    { v: String(k.husFirstCycle), l: "HUs completadas en 1ª regresión", c: PALETTE.greenPrimary },
    { v: String(k.husMultipleCycles), l: "HUs con 2+ regresiones (devoluciones a desarrollo)", c: PALETTE.amber },
    { v: `${k.capacityUtilizationPct}%`, l: "Capacidad del equipo utilizada", c: PALETTE.cyan },
  ];
  bottom.forEach((c, i) => {
    statCard(pres, s, { x: m + i * (card3W + gap), y: y2, w: card3W, h: h2, value: c.v, label: c.l, accent: c.c, valueSize: 34 });
  });

  // ── Footer contextual ──
  s.addText(
    `${k.totalProjects} proyectos  ·  ${k.totalAnalysts} analistas  ·  ${spec.periodLabel}`,
    {
      x: 0.6, y: SLIDE.heightIn - 0.7, w: SLIDE.widthIn - 1.2, h: 0.4,
      fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
    },
  );
}
