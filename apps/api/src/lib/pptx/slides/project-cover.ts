import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addProjectCoverSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header navy.
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 1.3,
    fill: { color: PALETTE.navyDeep }, line: { type: "none" },
  } as any);
  s.addText(p.projectName, {
    x: 0.5, y: 0.25, w: SLIDE.widthIn - 6, h: 0.6,
    fontFace: FONT.face, fontSize: 28, bold: true, color: PALETTE.white,
  });
  s.addText(`Cliente: ${p.clientName}`, {
    x: 0.5, y: 0.82, w: SLIDE.widthIn - 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight,
  });
  s.addText(`PM: ${p.projectManagerName ?? "—"}`, {
    x: SLIDE.widthIn - 5, y: 0.25, w: 4.5, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.white, align: "right",
  });
  s.addText(
    p.testers.map((t) => `${t.name} (${t.allocation}%)`).join(" · ") || "—",
    { x: SLIDE.widthIn - 5, y: 0.75, w: 4.5, h: 0.45, fontFace: FONT.face, fontSize: 12, color: PALETTE.cyan, align: "right" },
  );

  // 3 KPI cards.
  const kpis = [
    { v: String(p.kpis.designed), l: "Diseñados", c: PALETTE.blue },
    { v: String(p.kpis.executed), l: "Ejecutados", c: PALETTE.greenPrimary },
    { v: String(p.kpis.defects), l: "Defectos", c: PALETTE.red },
  ];
  const cardW = 3.5;
  const startX = (SLIDE.widthIn - (3 * cardW + 2 * 0.25)) / 2;
  const y = 1.8;
  kpis.forEach((kp, i) => {
    const x = startX + i * (cardW + 0.25);
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: 2,
      fill: { color: PALETTE.white }, line: { color: kp.c, width: 2 }, rectRadius: 0.1,
    } as any);
    s.addText(kp.v, {
      x, y: y + 0.3, w: cardW, h: 1.2,
      fontFace: FONT.face, fontSize: 56, bold: true, color: `#${kp.c}`, align: "center",
    });
    s.addText(kp.l, {
      x, y: y + 1.5, w: cardW, h: 0.4,
      fontFace: FONT.face, fontSize: 14, color: PALETTE.textMuted, align: "center",
    });
  });

  // Mini-pipeline (barras horizontales estilo "chip strip").
  const stripY = 4.3;
  const totalC = p.pipeline.reduce((s, q) => s + q.count, 0) || 1;
  let cursor = 0.5;
  const stripW = SLIDE.widthIn - 1;
  s.addText("Pipeline del proyecto", {
    x: 0.5, y: stripY - 0.5, w: stripW, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  for (const item of p.pipeline) {
    const w = (item.count / totalC) * stripW;
    s.addShape((pres as any).shapes.RECTANGLE, {
      x: cursor, y: stripY, w, h: 0.5,
      fill: { color: item.colorHex }, line: { color: "FFFFFF", width: 1 },
    } as any);
    s.addText(`${item.label} (${item.count})`, {
      x: cursor, y: stripY + 0.55, w, h: 0.4,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, align: "center",
    });
    cursor += w;
  }
}
