import type PptxGenJS from "pptxgenjs";
import type { AutomationLineRow, AutomationProjectReportData, ReportPeriod } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { slideHeader, statCard } from "../components.js";
import { scriptsWorked } from "../automation-report-math.js";
import {
  AUTOMATION_COLORS,
  buildExecutionsTrendChart,
  buildScriptsTrendChart,
} from "../charts/automation-charts.js";

const LINES_PER_SLIDE = 12;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function projectHeader(pres: PptxGenJS, s: PptxGenJS.Slide, p: AutomationProjectReportData): void {
  const headerH = 1.3;
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: headerH, fill: { color: PALETTE.navyDeep }, line: { type: "none" },
  } as any);
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: headerH, fill: { color: AUTOMATION_COLORS.created }, line: { type: "none" },
  } as any);
  s.addText(p.projectName, {
    x: 0.5, y: 0.22, w: SLIDE.widthIn - 6, h: 0.62,
    fontFace: FONT.face, fontSize: 28, bold: true, color: PALETTE.white,
  });
  s.addText(`Cliente: ${p.clientName}  ·  Automatización`, {
    x: 0.5, y: 0.84, w: SLIDE.widthIn - 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.greenLight,
  });
  s.addText(`PM: ${p.projectManagerName ?? "—"}`, {
    x: SLIDE.widthIn - 5, y: 0.28, w: 4.5, h: 0.4,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.white, align: "right",
  });
  s.addText(p.testers.map((t) => `${t.name} (${t.allocation}%)`).join("  ·  ") || "—", {
    x: SLIDE.widthIn - 5.5, y: 0.82, w: 5, h: 0.45,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.cyan, align: "right",
  });
}

/** Ficha del proyecto: KPIs de scripts y ejecuciones. */
export function addAutomationProjectCoverSlide(pres: PptxGenJS, p: AutomationProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  projectHeader(pres, s, p);

  const m = 0.9;
  const gap = 0.28;
  const cardW = (SLIDE.widthIn - 2 * m - 3 * gap) / 4;
  const k = p.kpis;

  s.addText("Producción de scripts", {
    x: m, y: 1.55, w: 6, h: 0.35, fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });
  [
    { v: String(scriptsWorked(k)), l: "Scripts trabajados", c: PALETTE.navyUi },
    { v: String(k.scriptsCreated), l: "Creados", c: AUTOMATION_COLORS.created },
    { v: String(k.scriptsRefactored), l: "Refactorizados", c: AUTOMATION_COLORS.refactored },
    { v: String(k.scriptsFixed), l: "Corregidos", c: AUTOMATION_COLORS.fixed },
  ].forEach((c, i) =>
    statCard(pres, s, { x: m + i * (cardW + gap), y: 1.95, w: cardW, h: 1.75, value: c.v, label: c.l, accent: c.c, valueSize: 40 }),
  );

  s.addText("Ejecución de pruebas automatizadas", {
    x: m, y: 3.95, w: 6, h: 0.35, fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });
  [
    { v: String(k.execTotal), l: "Casos ejecutados", c: PALETTE.cyan },
    { v: String(k.execPassed), l: "Pasados", c: AUTOMATION_COLORS.passed },
    { v: String(k.execFailed), l: "Fallidos", c: AUTOMATION_COLORS.failed },
    { v: k.execTotal > 0 ? `${k.passRatePct}%` : "—", l: "Tasa de éxito", c: k.execTotal > 0 && k.passRatePct < 80 ? PALETTE.amber : PALETTE.greenPrimary },
  ].forEach((c, i) =>
    statCard(pres, s, { x: m + i * (cardW + gap), y: 4.35, w: cardW, h: 1.75, value: c.v, label: c.l, accent: c.c, valueSize: 40 }),
  );

  s.addText(
    `${p.lines.length} ${p.lines.length === 1 ? "línea de prueba" : "líneas de prueba"} en el periodo`,
    {
      x: 0.6, y: SLIDE.heightIn - 0.8, w: SLIDE.widthIn - 1.2, h: 0.4,
      fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
    },
  );
}

function lineRow(l: AutomationLineRow): any[] {
  const base = { fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, align: "center", margin: 0.04, valign: "middle" };
  const num = (n: number, color?: string) => ({
    text: String(n),
    options: { ...base, color: n > 0 ? (color ?? PALETTE.textPrimary) : PALETTE.textMuted, bold: n > 0 && !!color },
  });
  return [
    { text: l.name, options: { ...base, align: "left", bold: true } },
    { text: l.responsibles.join(", ") || "—", options: { ...base, fontSize: 9, align: "left" } },
    { text: l.statusLabel, options: { ...base, fontSize: 9 } },
    num(l.scriptsCreated),
    num(l.scriptsRefactored),
    num(l.scriptsFixed),
    num(l.execTotal),
    num(l.execPassed),
    num(l.execFailed, PALETTE.red),
    { text: l.execTotal > 0 ? `${l.passRatePct}%` : "—", options: { ...base, bold: l.execTotal > 0 } },
    { text: l.lastNote ? truncate(l.lastNote, 140) : "—", options: { ...base, fontSize: 8, align: "left", color: l.lastNote ? PALETTE.textPrimary : PALETTE.textMuted } },
  ];
}

/** Detalle por línea de prueba (paginado si hay muchas líneas). */
export function addAutomationLinesSlides(pres: PptxGenJS, p: AutomationProjectReportData): void {
  const pages = Math.max(1, Math.ceil(p.lines.length / LINES_PER_SLIDE));
  const header = ["Línea de prueba", "Responsable", "Estado", "Creados", "Refact.", "Correg.", "Ejec.", "Pasados", "Fallidos", "% Éxito", "Observaciones"];
  const colW = [2.0, 1.45, 1.05, 0.7, 0.7, 0.7, 0.65, 0.75, 0.75, 0.75, 3.13];

  for (let page = 0; page < pages; page++) {
    const s = pres.addSlide();
    s.background = { color: PALETTE.grayLight };
    const suffix = pages > 1 ? ` (${page + 1}/${pages})` : "";
    slideHeader(pres, s, `Detalle por línea de prueba — ${p.projectName}${suffix}`);

    const rows: any[] = [
      header.map((h, i) => ({
        text: h,
        options: {
          bold: true, color: PALETTE.white, fontSize: 10, fontFace: FONT.face,
          align: i <= 1 || i === 10 ? "left" : "center", fill: { color: PALETTE.navyUi }, margin: 0.04,
        },
      })),
    ];
    const chunk = p.lines.slice(page * LINES_PER_SLIDE, (page + 1) * LINES_PER_SLIDE);
    for (const l of chunk) rows.push(lineRow(l));
    if (chunk.length === 0) {
      rows.push([{
        text: "(Sin líneas de prueba con actividad en el periodo)",
        options: { fontSize: 11, italic: true, color: PALETTE.textMuted, colspan: header.length, align: "center", fontFace: FONT.face },
      }]);
    }

    s.addTable(rows, {
      x: 0.35, y: 1.05, w: SLIDE.widthIn - 0.7, colW,
      border: { type: "solid", pt: 0.5, color: "E5E7EB" }, autoPage: false,
    } as any);

    s.addText("Creados / Refact. / Correg. = scripts de automatización  ·  Ejec. / Pasados / Fallidos = casos ejecutados  ·  Observaciones = última nota del periodo", {
      x: 0.3, y: SLIDE.heightIn - 0.45, w: SLIDE.widthIn - 0.6, h: 0.3,
      fontFace: FONT.face, fontSize: 9, italic: true, color: PALETTE.textMuted, align: "center",
    });
  }
}

/** Tendencia del periodo: scripts (izq.) y resultado de ejecuciones (der.). */
export async function addAutomationTrendSlide(
  pres: PptxGenJS,
  p: AutomationProjectReportData,
  period: ReportPeriod,
): Promise<void> {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  const unit = { weekly: "diaria", monthly: "semanal", yearly: "mensual" } as const;
  slideHeader(pres, s, `Tendencia ${unit[period]} — ${p.projectName}`);

  const [scripts, execs] = await Promise.all([buildScriptsTrendChart(p.trend), buildExecutionsTrendChart(p.trend)]);
  const w = (SLIDE.widthIn - 0.9) / 2;
  const h = w * (760 / 900);
  const y = 1.05 + Math.max(0, (SLIDE.heightIn - 1.05 - 0.2 - h) / 2);
  s.addImage({ data: `data:image/png;base64,${scripts.toString("base64")}`, x: 0.3, y, w, h });
  s.addImage({ data: `data:image/png;base64,${execs.toString("base64")}`, x: 0.6 + w, y, w, h });
}
