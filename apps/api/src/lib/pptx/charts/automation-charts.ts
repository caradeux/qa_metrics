import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { AutomationTrendPoint } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;
// Dos gráficos lado a lado en el slide: cada uno ocupa la mitad del ancho.
const canvas = new ChartJSNodeCanvas({ width: 900, height: 760, backgroundColour: "#FFFFFF" });

export const AUTOMATION_COLORS = {
  created: PALETTE.purple,
  refactored: PALETTE.blue,
  fixed: PALETTE.amber,
  passed: PALETTE.greenPrimary,
  failed: PALETTE.red,
} as const;

// Total encima de cada columna apilada (solo si es > 0).
const stackTotalsPlugin = {
  id: "stackTotals",
  afterDatasetsDraw(chart: any) {
    const ctx: CanvasRenderingContext2D = chart.ctx;
    const n = chart.data.labels.length;
    ctx.save();
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    ctx.fillStyle = `#${PALETTE.textPrimary}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let i = 0; i < n; i++) {
      let total = 0;
      let top = Infinity;
      let x = 0;
      chart.data.datasets.forEach((ds: any, di: number) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        total += Number(ds.data[i]) || 0;
        const bar = meta.data[i];
        if (bar) {
          top = Math.min(top, bar.y);
          x = bar.x;
        }
      });
      if (total > 0 && Number.isFinite(top)) ctx.fillText(String(total), x, top - 4);
    }
    ctx.restore();
  },
};

function stackedBars(
  title: string,
  labels: string[],
  datasets: Array<{ label: string; data: number[]; color: string }>,
): Promise<Buffer> {
  const cfg: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: `#${d.color}`,
        borderRadius: 4,
        stack: "total",
      })),
    },
    options: {
      responsive: false,
      layout: { padding: { top: 28 } },
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 24, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 10, bottom: 14 },
        },
        legend: {
          position: "top",
          labels: { font: { size: 15, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          // Espacio sobre la barra más alta para que su total no choque con la leyenda.
          grace: "12%",
          ticks: { font: { size: 13, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}`, precision: 0 },
          grid: { color: "rgba(107,114,128,0.18)" },
        },
      },
    },
    plugins: [stackTotalsPlugin],
  };
  return canvas.renderToBuffer(cfg, "image/png");
}

export function buildScriptsTrendChart(trend: AutomationTrendPoint[]): Promise<Buffer> {
  return stackedBars("Scripts trabajados", trend.map((t) => t.label), [
    { label: "Creados", data: trend.map((t) => t.scriptsCreated), color: AUTOMATION_COLORS.created },
    { label: "Refactorizados", data: trend.map((t) => t.scriptsRefactored), color: AUTOMATION_COLORS.refactored },
    { label: "Corregidos", data: trend.map((t) => t.scriptsFixed), color: AUTOMATION_COLORS.fixed },
  ]);
}

export function buildExecutionsTrendChart(trend: AutomationTrendPoint[]): Promise<Buffer> {
  return stackedBars("Resultado de ejecuciones", trend.map((t) => t.label), [
    { label: "Pasados", data: trend.map((t) => t.execPassed), color: AUTOMATION_COLORS.passed },
    { label: "Fallidos", data: trend.map((t) => t.execFailed), color: AUTOMATION_COLORS.failed },
  ]);
}
