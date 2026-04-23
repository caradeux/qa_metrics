import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ProjectPipeline, PortfolioTrendPoint } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;
const canvas = new ChartJSNodeCanvas({ width: 1400, height: 720, backgroundColour: "#FFFFFF" });

export async function buildPipelineDonut(pipeline: ProjectPipeline[]): Promise<Buffer> {
  const filtered = pipeline.filter((p) => p.count > 0);
  const cfg: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: filtered.map((p) => p.label),
      datasets: [{
        data: filtered.map((p) => p.count),
        backgroundColor: filtered.map((p) => `#${p.colorHex}`),
        borderColor: "#FFFFFF",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true, text: "Pipeline global por estado (HUs)",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: {
          position: "right",
          labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}`, padding: 12 },
        },
      },
      cutout: "55%",
    },
  };
  return canvas.renderToBuffer(cfg, "image/png");
}

// Plugin custom para dibujar el valor de cada barra encima de ella.
const barDataLabelsPlugin = {
  id: "barDataLabels",
  afterDatasetsDraw(chart: any) {
    const ctx: CanvasRenderingContext2D = chart.ctx;
    ctx.save();
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    chart.data.datasets.forEach((dataset: any, di: number) => {
      const meta = chart.getDatasetMeta(di);
      meta.data.forEach((bar: any, i: number) => {
        const value = dataset.data[i] as number;
        if (value === null || value === undefined) return;
        ctx.fillStyle = dataset.backgroundColor as string;
        ctx.fillText(String(value), bar.x, bar.y - 4);
      });
    });
    ctx.restore();
  },
};

export async function buildComparisonBars(
  data: Array<{ projectName: string; designed: number; executed: number }>,
): Promise<Buffer> {
  // Calcular totales para subtítulo.
  const totD = data.reduce((s, d) => s + d.designed, 0);
  const totE = data.reduce((s, d) => s + d.executed, 0);
  const ratio = totD > 0 ? Math.round((totE / totD) * 100) : 0;

  const cfg: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: data.map((d) => d.projectName),
      datasets: [
        {
          label: "Diseñados",
          data: data.map((d) => d.designed),
          backgroundColor: `#${PALETTE.blue}`,
          borderRadius: 6,
        },
        {
          label: "Ejecutados",
          data: data.map((d) => d.executed),
          backgroundColor: `#${PALETTE.greenPrimary}`,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: false,
      layout: { padding: { top: 36 } },
      plugins: {
        title: {
          display: true,
          text: [
            "Diseñados vs Ejecutados por proyecto",
            `Total: ${totD} diseñados · ${totE} ejecutados · ${ratio}% ratio`,
          ],
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 12, bottom: 18 },
        },
        legend: {
          position: "top",
          labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}`, maxRotation: 35 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}` },
          grid: { color: "rgba(107,114,128,0.18)" },
        },
      },
    },
    plugins: [barDataLabelsPlugin],
  };
  return canvas.renderToBuffer(cfg, "image/png");
}

export async function buildTrendLine(trend: PortfolioTrendPoint[]): Promise<Buffer> {
  let cD = 0, cE = 0, cB = 0;
  const cumD = trend.map((p) => (cD += p.designed, cD));
  const cumE = trend.map((p) => (cE += p.executed, cE));
  const cumB = trend.map((p) => (cB += p.defects, cB));

  const cfg: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: trend.map((p) => p.label),
      datasets: [
        { label: "Diseñados (acum.)", data: cumD, borderColor: `#${PALETTE.blue}`, backgroundColor: "rgba(8,172,244,0.15)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
        { label: "Ejecutados (acum.)", data: cumE, borderColor: `#${PALETTE.greenPrimary}`, backgroundColor: "rgba(37,207,108,0.15)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
        { label: "Defectos (acum.)", data: cumB, borderColor: `#${PALETTE.red}`, backgroundColor: "rgba(239,68,68,0.10)", fill: true, tension: 0.3, borderWidth: 3, pointRadius: 5 },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true, text: "Tendencia acumulada del portafolio",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: { position: "top", labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` } },
      },
      scales: {
        x: { ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` }, grid: { color: "rgba(107,114,128,0.10)" } },
        y: { beginAtZero: true, ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}` }, grid: { color: "rgba(107,114,128,0.18)" } },
      },
    },
  };
  return canvas.renderToBuffer(cfg, "image/png");
}
