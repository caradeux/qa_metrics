import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { statCard, flowBar, legendCard } from "../components.js";

export function addProjectCoverSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // ── Header navy (proyecto + cliente a la izq; PM + testers a la der) ──
  const headerH = 1.3;
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: headerH,
    fill: { color: PALETTE.navyDeep }, line: { type: "none" },
  } as any);
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: headerH, fill: { color: PALETTE.greenPrimary }, line: { type: "none" },
  } as any);
  s.addText(p.projectName, {
    x: 0.5, y: 0.22, w: SLIDE.widthIn - 6, h: 0.62,
    fontFace: FONT.face, fontSize: 28, bold: true, color: PALETTE.white,
  });
  s.addText(`Cliente: ${p.clientName}`, {
    x: 0.5, y: 0.84, w: SLIDE.widthIn - 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight,
  });
  s.addText(`PM: ${p.projectManagerName ?? "—"}`, {
    x: SLIDE.widthIn - 5, y: 0.28, w: 4.5, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.white, align: "right",
  });
  s.addText(
    p.testers.map((t) => `${t.name} (${t.allocation}%)`).join("  ·  ") || "—",
    { x: SLIDE.widthIn - 5.5, y: 0.82, w: 5, h: 0.45, fontFace: FONT.face, fontSize: 12, color: PALETTE.cyan, align: "right" },
  );

  // ── 3 KPI cards refinadas ──
  const gap = 0.3;
  const m = 0.9;
  const cardW = (SLIDE.widthIn - 2 * m - 2 * gap) / 3;
  const ky = 1.75;
  const kh = 1.85;
  const kpis = [
    { v: String(p.kpis.designed), l: "Casos Diseñados", c: PALETTE.blue },
    { v: String(p.kpis.executed), l: "Casos Ejecutados", c: PALETTE.greenPrimary },
    { v: String(p.kpis.defects), l: "Defectos Detectados", c: PALETTE.red },
  ];
  kpis.forEach((kp, i) => {
    statCard(pres, s, { x: m + i * (cardW + gap), y: ky, w: cardW, h: kh, value: kp.v, label: kp.l, accent: kp.c, valueSize: 44 });
  });

  // ── Pipeline del proyecto ──
  const total = p.pipeline.reduce((acc, q) => acc + q.count, 0);
  s.addText("Pipeline del proyecto", {
    x: 0.9, y: 4.05, w: SLIDE.widthIn - 1.8, h: 0.35,
    fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });

  if (total === 0) {
    s.addText("(Sin historias de usuario en seguimiento este periodo)", {
      x: 0.9, y: 4.5, w: SLIDE.widthIn - 1.8, h: 0.5,
      fontFace: FONT.face, fontSize: 13, italic: true, color: PALETTE.textMuted,
    });
    return;
  }

  flowBar(pres, s, { x: 0.9, y: 4.45, w: SLIDE.widthIn - 1.8, h: 0.95, items: p.pipeline, total });

  // Tarjetas de estado debajo de la barra (hasta 5 columnas).
  const items = p.pipeline.filter((q) => q.count > 0);
  const cols = Math.min(5, items.length);
  const cgap = 0.25;
  const lcW = (SLIDE.widthIn - 1.8 - cgap * (cols - 1)) / cols;
  const lcH = 1.0;
  const lcY = 5.75;
  items.slice(0, cols * 1).forEach((item, i) => {
    const pct = Math.round((item.count / total) * 100);
    legendCard(pres, s, {
      x: 0.9 + i * (lcW + cgap), y: lcY, w: lcW, h: lcH,
      value: String(item.count), label: item.label, sub: `${pct}% del total`, accent: item.colorHex,
    });
  });
}
