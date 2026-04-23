import type PptxGenJS from "pptxgenjs";
import type { OccupationResult } from "../../occupation.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

function formatHours(h: number): string {
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

export function addAnalystDetailSlide(pres: PptxGenJS, a: OccupationResult): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Analista — ${a.testerName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 5, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });
  s.addText(`Periodo: ${a.workdays} días hábiles`, {
    x: SLIDE.widthIn - 4.8, y: 0.25, w: 4.3, h: 0.4,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.greenLight, align: "right",
  });

  // Narrativa de capacidad ajustada
  const nominal = a.nominalCapacityHours ?? a.capacityHours + (a.absenceHours ?? 0);
  const absence = a.absenceHours ?? 0;
  const effectiveCap = a.capacityHours;

  s.addText(
    absence > 0
      ? `Capacidad nominal: ${formatHours(nominal)}   −   ${formatHours(absence)} de ausencia   =   ${formatHours(effectiveCap)} efectivas`
      : `Capacidad semanal: ${formatHours(effectiveCap)}`,
    {
      x: 0.5, y: 1.0, w: SLIDE.widthIn - 1, h: 0.35,
      fontFace: FONT.face, fontSize: 13, color: PALETTE.textMuted, align: "center",
    },
  );

  // KPI cards
  const kpis: Array<{ v: string; l: string; c: string }> = [
    { v: formatHours(effectiveCap), l: "Capacidad efectiva", c: PALETTE.blue },
    { v: formatHours(a.activityHours), l: "Reuniones / Actividades", c: PALETTE.purple },
    { v: formatHours(a.productiveHoursEstimate), l: "Horas productivas QA", c: PALETTE.greenPrimary },
    { v: `${a.occupationPct}%`, l: "Ocupación", c: a.overallocated ? PALETTE.red : PALETTE.cyan },
  ];
  const cardW = 2.9;
  const startX = 0.5;
  kpis.forEach((kp, i) => {
    const x = startX + i * (cardW + 0.15);
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x, y: 1.5, w: cardW, h: 1.25,
      fill: { color: PALETTE.white }, line: { color: kp.c, width: 2 }, rectRadius: 0.08,
    } as any);
    s.addText(kp.v, {
      x, y: 1.58, w: cardW, h: 0.65,
      fontFace: FONT.face, fontSize: 26, bold: true, color: `#${kp.c}`, align: "center",
    });
    s.addText(kp.l, {
      x, y: 2.25, w: cardW, h: 0.35,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textMuted, align: "center",
    });
  });

  const leftX = 0.5;
  const rightX = 6.8;
  const colW = 6;
  const tableY = 3.05;

  // IZQ: Ausencias + Categorías Activity
  let cursorY = tableY;

  if (a.byAbsence && a.byAbsence.length > 0) {
    s.addText("Ausencias (descuentan capacidad)", {
      x: leftX, y: cursorY, w: colW, h: 0.35,
      fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
    });
    cursorY += 0.4;
    const absRows: any[] = [[
      { text: "Categoría", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face } },
      { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face, align: "right" } },
    ]];
    for (const c of a.byAbsence) {
      absRows.push([
        { text: c.name, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
        { text: formatHours(c.hours), options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
      ]);
    }
    s.addTable(absRows, { x: leftX, y: cursorY, w: colW, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any);
    cursorY += 0.3 * absRows.length + 0.25;
  }

  s.addText("Reuniones y actividades", {
    x: leftX, y: cursorY, w: colW, h: 0.35,
    fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });
  cursorY += 0.4;
  const catRows: any[] = [[
    { text: "Categoría", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face, align: "right" } },
  ]];
  for (const c of a.byCategory) {
    catRows.push([
      { text: c.name, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: formatHours(c.hours), options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byCategory.length === 0) {
    catRows.push([{ text: "(Sin actividades registradas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(catRows, { x: leftX, y: cursorY, w: colW, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any);

  // DER: Horas ligadas a HUs
  s.addText("Horas dedicadas por HU (reuniones vinculadas)", {
    x: rightX, y: tableY, w: colW, h: 0.35,
    fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });
  const asgRows: any[] = [[
    { text: "Historia de Usuario", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face } },
    { text: "Horas", options: { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, fontSize: 10, fontFace: FONT.face, align: "right" } },
  ]];
  for (const g of a.byAssignment) {
    asgRows.push([
      { text: g.storyTitle, options: { fontSize: 10, color: PALETTE.textPrimary, fontFace: FONT.face } },
      { text: formatHours(g.hours), options: { fontSize: 10, color: PALETTE.textPrimary, align: "right", fontFace: FONT.face } },
    ]);
  }
  if (a.byAssignment.length === 0) {
    asgRows.push([{ text: "(Sin reuniones/actividades vinculadas a HU específicas)", options: { fontSize: 10, italic: true, color: PALETTE.textMuted, colspan: 2, align: "center", fontFace: FONT.face } }]);
  }
  s.addTable(asgRows, { x: rightX, y: tableY + 0.4, w: colW, colW: [4.5, 1.5], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any);

  // Pie narrativo
  const narrativeY = SLIDE.heightIn - 0.7;
  s.addText(
    `De ${formatHours(effectiveCap)} efectivas: ${formatHours(a.activityHours)} en reuniones/actividades y ${formatHours(a.productiveHoursEstimate)} en trabajo productivo QA (análisis, diseño, ejecución, reporte de defectos).`,
    {
      x: 0.5, y: narrativeY, w: SLIDE.widthIn - 1, h: 0.4,
      fontFace: FONT.face, fontSize: 10, italic: true, color: PALETTE.textMuted, align: "center",
    },
  );

  if (a.overallocated) {
    s.addText("⚠ Analista sobre-asignado en el periodo", {
      x: 0.5, y: SLIDE.heightIn - 0.3, w: SLIDE.widthIn - 1, h: 0.25,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.red, align: "center",
    });
  }
}
