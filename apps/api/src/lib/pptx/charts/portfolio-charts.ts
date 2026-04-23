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

export async function buildComparisonBars(
  data: Array<{ projectName: string; designed: number; executed: number }>,
): Promise<Buffer> {
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
      plugins: {
        title: {
          display: true, text: "Diseñados vs Ejecutados por proyecto",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`, padding: { top: 12, bottom: 18 },
        },
        legend: { position: "top", labels: { font: { size: 14, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` } },
      },
      scales: {
        x: { ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}`, maxRotation: 35 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}` }, grid: { color: "rgba(107,114,128,0.18)" } },
      },
    },
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
