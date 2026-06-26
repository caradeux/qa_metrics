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
  const colW = [5.15, 0.5, 0.7, 0.7, 1.55, 0.55, 0.55, 0.55, 1.6];

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
    const huText = (h.externalId ? `${h.externalId} · ` : "") + truncate(h.title, 68) + (h.priorDesign ? " *" : "");
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
    x: 0.3, y: 1.0, w: 11.85, colW,
    border: { type: "solid", pt: 0.5, color: "E5E7EB" },
  } as any);

  // Callout: HUs "En Diseño" cuyo diseño se hizo en semanas previas (marcadas con
  // * en la tabla). Aclara que el Dis.=0 de la semana NO significa estancamiento.
  // Se ubica pegado bajo la tabla y con estilo destacado para que se note.
  const priorDesigned = sorted.filter((h) => h.priorDesign);
  if (priorDesigned.length > 0) {
    const MAX_NOTES = 6;
    const visible = priorDesigned.slice(0, MAX_NOTES);
    const overflow = priorDesigned.length - visible.length;
    const entries = visible.map((h) => {
      const id = h.externalId ?? truncate(h.title, 22);
      return `${id} — ${h.priorDesign!.weekRangeLabel} (${h.priorDesign!.totalDesigned} casos)`;
    });
    const detail = entries.join("    ·    ") + (overflow > 0 ? `    ·    +${overflow} más` : "");

    // Posición: justo bajo la tabla (alto estimado) sin chocar con la leyenda.
    const estTableBottom = 1.0 + (sorted.length + 1) * 0.3;
    const cy = Math.min(estTableBottom + 0.3, SLIDE.heightIn - 1.65);
    const cx = 0.3;
    const cw = SLIDE.widthIn - 0.6;
    const ch = 0.78;

    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: cx, y: cy, w: cw, h: ch,
      fill: { color: "FEF3C7" }, line: { color: PALETTE.amber, width: 1 }, rectRadius: 0.06,
    } as any);
    s.addShape((pres as any).shapes.RECTANGLE, {
      x: cx, y: cy, w: 0.09, h: ch, fill: { color: PALETTE.amber }, line: { type: "none" },
    } as any);
    s.addText(
      [
        { text: "✳  ", options: { bold: true, color: PALETTE.amber } },
        { text: "Diseño realizado en semanas previas", options: { bold: true, color: PALETTE.textPrimary } },
        { text: "  —  no aparece esta semana porque ya estaba hecho (las HU marcadas con * en la tabla).", options: { italic: true, color: PALETTE.textMuted } },
      ] as any,
      {
        x: cx + 0.25, y: cy + 0.08, w: cw - 0.4, h: 0.3,
        fontFace: FONT.face, fontSize: 11, valign: "middle",
      } as any,
    );
    s.addText(detail, {
      x: cx + 0.25, y: cy + 0.42, w: cw - 0.4, h: 0.3,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, valign: "middle", wrap: true,
    } as any);
  }

  // Leyenda de iconos al pie.
  s.addText("📚 Capacitación/Inducción   ·   👤 Reunión con usuario   ·   💻 Reunión con desarrollo   ·   R# = n° de regresión   ·   C-Dis/C-Ejec = complejidad", {
    x: 0.3, y: SLIDE.heightIn - 0.45, w: SLIDE.widthIn - 0.6, h: 0.3,
    fontFace: FONT.face, fontSize: 9, italic: true, color: PALETTE.textMuted, align: "center",
  });
}
