import type PptxGenJS from "pptxgenjs";
import type { OccupationResult } from "../../occupation.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addAnalystDetailSlide(pres: PptxGenJS, a: OccupationResult): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Analista — ${a.testerName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const kpis: Array<{ v: string; l: string; c: string }> = [
    { v: `${a.capacityHours}h`, l: "Capacidad", c: PALETTE.blue },
    { v: `${a.activityHours}h`, l: "Horas de Activity", c: PALETTE.purple },
    { v: `${a.productiveHoursEstimate}h`, l: "Horas productivas estimadas", c: PALETTE.greenPrimary },
    { v: `${a.occupationPct}%`, l: "Ocupación", c: a.overallocated ? PALETTE.red : PALETTE.cyan },
  ];
  const cardW = 2.9;
  const startX = 0.5;
  kpis.forEach((kp, i) => {
    const x = startX + i * (cardW + 0.15);
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x, y: 1.1, w: cardW, h: 1.3,
      fill: { color: PALETTE.white }, line: { color: kp.c, width: 2 }, rectRadius: 0.08,
    } as any);
    s.addText(kp.v, {
      x, y: 1.2, w: cardW, h: 0.7,
      fontFace: FONT.face, fontSize: 28, bold: true, color: `#${kp.c}`, align: "center",
    });
    s.addText(kp.l, {
      x, y: 1.95, w: cardW, h: 0.35,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textMuted, align: "center",
    });
  });

  // Tabla de categorías.
  s.addText("Horas por categoría", {
    x: 0.5, y: 2.7, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const catRows: any[] = [[
    { text: "Categoría", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face, align: "right" } },
  ]];
  for (const c of a.byCategory) {
    catRows.push([
      { text: c.name, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: `${c.hours.toFixed(1)}h`, options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byCategory.length === 0) {
    catRows.push([{ text: "(Sin actividades registradas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(catRows, { x: 0.5, y: 3.2, w: 6, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any);

  // Tabla de assignments.
  s.addText("Horas por asignación", {
    x: 6.8, y: 2.7, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const asgRows: any[] = [[
    { text: "Historia de Usuario", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 11, fontFace: FONT.face, align: "right" } },
  ]];
  for (const g of a.byAssignment) {
    asgRows.push([
      { text: g.storyTitle, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: `${g.hours.toFixed(1)}h`, options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byAssignment.length === 0) {
    asgRows.push([{ text: "(Sin asignaciones con horas registradas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(asgRows, { x: 6.8, y: 3.2, w: 6, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any);

  if (a.overallocated) {
    s.addText("⚠ Analista sobre-asignado en el periodo", {
      x: 0.5, y: SLIDE.heightIn - 0.6, w: SLIDE.widthIn - 1, h: 0.4,
      fontFace: FONT.face, fontSize: 12, bold: true, color: PALETTE.red, align: "center",
    });
  }
}
