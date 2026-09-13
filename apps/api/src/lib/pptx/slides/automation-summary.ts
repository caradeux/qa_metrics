import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { slideHeader, statCard, flowBar } from "../components.js";
import { automationPortfolioTotals, scriptsWorked } from "../automation-report-math.js";
import { AUTOMATION_COLORS } from "../charts/automation-charts.js";

/** Resumen ejecutivo de automatización: producción de scripts, resultados y comparación por proyecto. */
export function addAutomationSummarySlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };
  slideHeader(pres, s, "Resumen de automatización", { rightText: spec.periodLabel });

  const t = automationPortfolioTotals(spec.automationProjects);
  const m = 0.7;
  const gap = 0.28;
  const cardW = (SLIDE.widthIn - 2 * m - 3 * gap) / 4;

  const scripts = [
    { v: String(scriptsWorked(t)), l: "Scripts trabajados", c: PALETTE.navyUi },
    { v: String(t.scriptsCreated), l: "Scripts creados", c: AUTOMATION_COLORS.created },
    { v: String(t.scriptsRefactored), l: "Scripts refactorizados", c: AUTOMATION_COLORS.refactored },
    { v: String(t.scriptsFixed), l: "Scripts corregidos", c: AUTOMATION_COLORS.fixed },
  ];
  scripts.forEach((c, i) =>
    statCard(pres, s, { x: m + i * (cardW + gap), y: 1.25, w: cardW, h: 1.6, value: c.v, label: c.l, accent: c.c, valueSize: 36 }),
  );

  const execs = [
    { v: String(t.execTotal), l: "Casos ejecutados", c: PALETTE.cyan },
    { v: String(t.execPassed), l: "Pasados", c: AUTOMATION_COLORS.passed },
    { v: String(t.execFailed), l: "Fallidos", c: AUTOMATION_COLORS.failed },
    { v: `${t.passRatePct}%`, l: "Tasa de éxito", c: t.execTotal > 0 && t.passRatePct < 80 ? PALETTE.amber : PALETTE.greenPrimary },
  ];
  execs.forEach((c, i) =>
    statCard(pres, s, { x: m + i * (cardW + gap), y: 3.1, w: cardW, h: 1.6, value: c.v, label: c.l, accent: c.c, valueSize: 36 }),
  );

  // Aporte por proyecto (solo si hay más de uno): barra de scripts + ejecuciones.
  const projects = spec.automationProjects;
  s.addText(projects.length > 1 ? "Aporte por proyecto" : "Resultado de ejecuciones", {
    x: m, y: 4.95, w: SLIDE.widthIn - 2 * m, h: 0.35,
    fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.textPrimary,
  });

  if (projects.length > 1) {
    const rows = [...projects].sort((a, b) => scriptsWorked(b.kpis) - scriptsWorked(a.kpis)).slice(0, 5);
    const header = ["Proyecto", "Líneas", "Scripts", "Ejecutados", "Fallidos", "% Éxito"];
    const cell = (text: string, opts: Record<string, unknown> = {}) => ({
      text,
      options: { fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, align: "center", margin: 0.04, ...opts },
    });
    s.addTable(
      [
        header.map((h, i) => cell(h, { bold: true, color: PALETTE.white, fill: { color: PALETTE.navyUi }, align: i === 0 ? "left" : "center" })),
        ...rows.map((p) => [
          cell(p.projectName, { align: "left" }),
          cell(String(p.lines.length)),
          cell(String(scriptsWorked(p.kpis))),
          cell(String(p.kpis.execTotal)),
          cell(String(p.kpis.execFailed), { color: p.kpis.execFailed > 0 ? PALETTE.red : PALETTE.textMuted, bold: p.kpis.execFailed > 0 }),
          cell(p.kpis.execTotal > 0 ? `${p.kpis.passRatePct}%` : "—"),
        ]),
      ] as any,
      { x: m, y: 5.35, w: SLIDE.widthIn - 2 * m, colW: [5.33, 1.2, 1.2, 1.4, 1.4, 1.4], border: { type: "solid", pt: 0.5, color: "E5E7EB" } } as any,
    );
  } else if (t.execTotal > 0) {
    flowBar(pres, s, {
      x: m, y: 5.4, w: SLIDE.widthIn - 2 * m, h: 0.85,
      items: [
        { label: "Pasados", count: t.execPassed, colorHex: AUTOMATION_COLORS.passed },
        { label: "Fallidos", count: t.execFailed, colorHex: AUTOMATION_COLORS.failed },
      ],
      total: t.execTotal,
    });
  } else {
    s.addText("(Sin ejecuciones registradas en el periodo)", {
      x: m, y: 5.4, w: SLIDE.widthIn - 2 * m, h: 0.5,
      fontFace: FONT.face, fontSize: 13, italic: true, color: PALETTE.textMuted,
    });
  }

  s.addText(
    `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}  ·  ${t.totalLines} ${t.totalLines === 1 ? "línea de prueba" : "líneas de prueba"}  ·  ${spec.periodLabel}`,
    {
      x: 0.6, y: SLIDE.heightIn - 0.55, w: SLIDE.widthIn - 1.2, h: 0.35,
      fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
    },
  );
}
