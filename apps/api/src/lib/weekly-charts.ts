import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";

// Ancho/alto en pixeles para los PNG generados. Se escalan dentro del PPTX.
const WIDTH = 1200;
const HEIGHT = 700;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#FFFFFF",
});

// Paleta alineada con la del PPTX original
const PALETTE = {
  navy: "#0F172A",
  cyan: "#06B6D4",
  green: "#22C55E",
  blue: "#2D8DBB",
  blueLight: "#94C7E3",
  red: "#EF4444",
  orange: "#F97316",
  violet: "#8B5CF6",
  amber: "#F59E0B",
  gray: "#64748B",
  textMuted: "#94A3B8",
};

// Asigna un color a cada label de estado (para el pipeline donut)
const STATUS_COLOR: Record<string, string> = {
  "No Iniciado": PALETTE.gray,
  "En Diseño": PALETTE.blue,
  "Pdte. Instalación QA": PALETTE.amber,
  "En Curso": PALETTE.cyan,
  "Devuelto a Desarrollo": PALETTE.red,
  "Pdte. Aprobación": PALETTE.violet,
  "Completado": PALETTE.green,
  "Detenido": PALETTE.gray,
};

export interface PipelineDatum {
  label: string;
  count: number;
}

export async function buildPipelineDonut(data: PipelineDatum[]): Promise<Buffer> {
  const filtered = data.filter((d) => d.count > 0);
  const config: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: filtered.map((d) => d.label),
      datasets: [
        {
          data: filtered.map((d) => d.count),
          backgroundColor: filtered.map((d) => STATUS_COLOR[d.label] ?? PALETTE.gray),
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Pipeline por estado (HUs)",
          font: { size: 28, weight: "bold", family: "Arial" },
          color: PALETTE.navy,
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "right",
          labels: {
            font: { size: 18, family: "Arial" },
            color: PALETTE.navy,
            padding: 16,
          },
        },
      },
      cutout: "55%",
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}

export interface ProjectMetricsDatum {
  projectName: string;
  designed: number;
  executed: number;
  defects: number;
}

export async function buildDesignedVsExecutedBars(data: ProjectMetricsDatum[]): Promise<Buffer> {
  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: data.map((d) => d.projectName),
      datasets: [
        {
          label: "Casos Diseñados",
          data: data.map((d) => d.designed),
          backgroundColor: PALETTE.blue,
          borderRadius: 4,
        },
        {
          label: "Casos Ejecutados",
          data: data.map((d) => d.executed),
          backgroundColor: PALETTE.cyan,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Casos Diseñados vs Ejecutados por proyecto",
          font: { size: 28, weight: "bold", family: "Arial" },
          color: PALETTE.navy,
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "top",
          labels: {
            font: { size: 18, family: "Arial" },
            color: PALETTE.navy,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 14, family: "Arial" },
            color: PALETTE.navy,
            maxRotation: 35,
            minRotation: 0,
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 14, family: "Arial" },
            color: PALETTE.textMuted,
          },
          grid: { color: "#E2E8F0" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}

export async function buildDefectsBars(data: ProjectMetricsDatum[]): Promise<Buffer> {
  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: data.map((d) => d.projectName),
      datasets: [
        {
          label: "Bugs detectados",
          data: data.map((d) => d.defects),
          backgroundColor: PALETTE.red,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Defectos por proyecto",
          font: { size: 28, weight: "bold", family: "Arial" },
          color: PALETTE.navy,
          padding: { top: 10, bottom: 20 },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 14, family: "Arial" },
            color: PALETTE.navy,
            maxRotation: 35,
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 14, family: "Arial" },
            color: PALETTE.textMuted,
            precision: 0,
          },
          grid: { color: "#E2E8F0" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}

export interface ChartBuffers {
  pipeline: Buffer;
  designedVsExecuted: Buffer;
  defects: Buffer;
}
