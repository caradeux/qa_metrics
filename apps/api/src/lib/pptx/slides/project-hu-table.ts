import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData, ComplexityLevel, HuRow } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

function regressionChip(n: number): { label: string; color: string } {
  if (n <= 1) return { label: "R1", color: PALETTE.textMuted };
  if (n === 2) return { label: "R2", color: PALETTE.amber };
  return { label: `R${n}`, color: PALETTE.red };
}

function complexityColor(c: ComplexityLevel): string {
  if (c === "HIGH") return PALETTE.red;
  if (c === "MEDIUM") return PALETTE.amber;
  return PALETTE.greenPrimary;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function formatHours(h: number): string {
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function contextBadges(h: HuRow): string {
  const parts: string[] = [];
  if (h.trainingHours > 0) parts.push(`📚 ${formatHours(h.trainingHours)}`);
  if (h.userMeetingHours > 0) parts.push(`👤 ${formatHours(h.userMeetingHours)}`);
  if (h.devMeetingHours > 0) parts.push(`💻 ${formatHours(h.devMeetingHours)}`);
  return parts.join("  ");
}

export function addProjectHuTableSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Detalle por Historia de Usuario — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const header = ["Historia de Usuario", "R#", "C-Dis.", "C-Ejec.", "Estado", "Dis.", "Ejec.", "Def.", "Contexto"];
  const colW = [3.9, 0.55, 0.75, 0.75, 1.8, 0.6, 0.6, 0.6, 2.55];

  const rows: any[] = [];

  rows.push(header.map((h, i) => ({
    text: h,
    options: {
      bold: true, color: PALETTE.white, fontSize: 10, fontFace: FONT.face,
      align: i === 0 ? "left" : "center",
      fill: { color: PALETTE.navyUi },
      margin: 0.05,
    },
  })));

  const sorted = [...p.hus].sort((a, b) => (b.regressionNumber - a.regressionNumber) || a.title.localeCompare(b.title));

  for (const h of sorted) {
    const chip = regressionChip(h.regressionNumber);
    const cdc = complexityColor(h.designComplexity);
    const cec = complexityColor(h.executionComplexity);
    const huText = (h.externalId ? `${h.externalId} · ` : "") + truncate(h.title, 50);
    const ctx = contextBadges(h);
    rows.push([
      { text: huText, options: { fontSize: 9, fontFace: FONT.face, color: PALETTE.textPrimary, margin: 0.05 } },
      { text: chip.label, options: { fontSize: 9, bold: true, color: PALETTE.white, fill: { color: chip.color }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.designComplexity, options: { fontSize: 8, color: PALETTE.white, fill: { color: cdc }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.executionComplexity, options: { fontSize: 8, color: PALETTE.white, fill: { color: cec }, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: h.statusLabel, options: { fontSize: 8, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.designed), options: { fontSize: 10, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.executed), options: { fontSize: 10, color: PALETTE.textPrimary, align: "center", fontFace: FONT.face, margin: 0.05 } },
      { text: String(h.defects), options: { fontSize: 10, color: h.defects > 0 ? PALETTE.red : PALETTE.textMuted, align: "center", bold: h.defects > 0, fontFace: FONT.face, margin: 0.05 } },
      { text: ctx || "—", options: { fontSize: 8, color: ctx ? PALETTE.textPrimary : PALETTE.textMuted, align: "left", fontFace: FONT.face, margin: 0.05 } },
    ]);
  }

  if (sorted.length === 0) {
    rows.push([{
      text: "(Sin HUs con actividad en el periodo)",
      options: { fontSize: 11, italic: true, color: PALETTE.textMuted, colspan: 9, align: "center", fontFace: FONT.face },
    }]);
  }

  s.addTable(rows, {
    x: 0.3, y: 1.0, w: 12.1, colW,
    border: { type: "solid", pt: 0.5, color: "E5E7EB" },
  } as any);

  // Leyenda de iconos al pie.
  s.addText("📚 Capacitación/Inducción   ·   👤 Reunión con usuario   ·   💻 Reunión con desarrollo   ·   R# = n° de regresión   ·   C-Dis/C-Ejec = complejidad", {
    x: 0.3, y: SLIDE.heightIn - 0.45, w: SLIDE.widthIn - 0.6, h: 0.3,
    fontFace: FONT.face, fontSize: 9, italic: true, color: PALETTE.textMuted, align: "center",
  });
}
