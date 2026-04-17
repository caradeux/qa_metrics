import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";

// Ancho/alto en pixeles para los PNG generados. Se escalan dentro del PPTX.
const WIDTH = 1200;
const HEIGHT = 700;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#0F172A",
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
          borderColor: PALETTE.navy,
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
          font: { size: 28, weight: "bold", family: "DejaVu Sans, Arial, sans-serif" },
          color: "#FFFFFF",
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "right",
          labels: {
            font: { size: 18, family: "DejaVu Sans, Arial, sans-serif" },
            color: "#E2E8F0",
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

const DARK_GRID = "rgba(148, 163, 184, 0.2)";

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
          font: { size: 28, weight: "bold", family: "DejaVu Sans, Arial, sans-serif" },
          color: "#FFFFFF",
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "top",
          labels: { font: { size: 18, family: "DejaVu Sans, Arial, sans-serif" }, color: "#E2E8F0" },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 14, family: "DejaVu Sans, Arial, sans-serif" }, color: "#E2E8F0", maxRotation: 35, minRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 14, family: "DejaVu Sans, Arial, sans-serif" }, color: PALETTE.textMuted },
          grid: { color: DARK_GRID },
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
          font: { size: 28, weight: "bold", family: "DejaVu Sans, Arial, sans-serif" },
          color: "#FFFFFF",
          padding: { top: 10, bottom: 20 },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 14, family: "DejaVu Sans, Arial, sans-serif" }, color: "#E2E8F0", maxRotation: 35 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 14, family: "DejaVu Sans, Arial, sans-serif" }, color: PALETTE.textMuted, precision: 0 },
          grid: { color: DARK_GRID },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}

export interface WeekBucket {
  label: string;
  designed: number;
  executed: number;
  defects: number;
}

export async function buildMonthlyCumulativeBars(
  weeks: WeekBucket[],
  monthLabel: string,
): Promise<Buffer> {
  // Calcular acumulados (running totals)
  let cumD = 0, cumE = 0, cumB = 0;
  const cumDesigned = weeks.map((w) => { cumD += w.designed; return cumD; });
  const cumExecuted = weeks.map((w) => { cumE += w.executed; return cumE; });
  const cumDefects = weeks.map((w) => { cumB += w.defects; return cumB; });

  const FONT = "DejaVu Sans, Arial, sans-serif";
  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: weeks.map((w) => w.label),
      datasets: [
        {
          label: "Diseñados (acum.)",
          data: cumDesigned,
          borderColor: PALETTE.blue,
          backgroundColor: "rgba(45, 141, 187, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: PALETTE.blue,
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          borderWidth: 3,
        },
        {
          label: "Ejecutados (acum.)",
          data: cumExecuted,
          borderColor: PALETTE.cyan,
          backgroundColor: "rgba(6, 182, 212, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: PALETTE.cyan,
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          borderWidth: 3,
        },
        {
          label: "Defectos (acum.)",
          data: cumDefects,
          borderColor: PALETTE.red,
          backgroundColor: "rgba(239, 68, 68, 0.10)",
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: PALETTE.red,
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: [`Acumulado Mensual — ${monthLabel}`, `Total: ${cumD} diseñados · ${cumE} ejecutados · ${cumB} defectos`],
          font: { size: 24, weight: "bold", family: FONT },
          color: "#FFFFFF",
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "top",
          labels: { font: { size: 16, family: FONT }, color: "#E2E8F0", usePointStyle: true, pointStyle: "circle", padding: 20 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 16, family: FONT }, color: "#E2E8F0" },
          grid: { color: "rgba(148,163,184,0.15)" },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 14, family: FONT }, color: PALETTE.textMuted, precision: 0 },
          grid: { color: "rgba(148,163,184,0.2)" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}

export interface MonthBucket {
  label: string;
  designed: number;
  executed: number;
  defects: number;
}

export async function buildYearlyCumulativeBars(
  months: MonthBucket[],
  year: number,
): Promise<Buffer> {
  let cumD = 0, cumE = 0, cumB = 0;
  const cD = months.map((m) => { cumD += m.designed; return cumD; });
  const cE = months.map((m) => { cumE += m.executed; return cumE; });
  const cB = months.map((m) => { cumB += m.defects; return cumB; });
  const FONT = "DejaVu Sans, Arial, sans-serif";
  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "Diseñados (acum.)",
          data: cD,
          borderColor: PALETTE.blue,
          backgroundColor: "rgba(45, 141, 187, 0.15)",
          fill: true, tension: 0.3, pointRadius: 5,
          pointBackgroundColor: PALETTE.blue, pointBorderColor: "#FFFFFF", pointBorderWidth: 2, borderWidth: 3,
        },
        {
          label: "Ejecutados (acum.)",
          data: cE,
          borderColor: PALETTE.cyan,
          backgroundColor: "rgba(6, 182, 212, 0.15)",
          fill: true, tension: 0.3, pointRadius: 5,
          pointBackgroundColor: PALETTE.cyan, pointBorderColor: "#FFFFFF", pointBorderWidth: 2, borderWidth: 3,
        },
        {
          label: "Defectos (acum.)",
          data: cB,
          borderColor: PALETTE.red,
          backgroundColor: "rgba(239, 68, 68, 0.10)",
          fill: true, tension: 0.3, pointRadius: 5,
          pointBackgroundColor: PALETTE.red, pointBorderColor: "#FFFFFF", pointBorderWidth: 2, borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: [`Acumulado Anual — ${year}`, `Total: ${cumD} diseñados · ${cumE} ejecutados · ${cumB} defectos`],
          font: { size: 24, weight: "bold", family: FONT },
          color: "#FFFFFF",
          padding: { top: 10, bottom: 20 },
        },
        legend: {
          position: "top",
          labels: { font: { size: 16, family: FONT }, color: "#E2E8F0", usePointStyle: true, pointStyle: "circle", padding: 20 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 14, family: FONT }, color: "#E2E8F0" },
          grid: { color: "rgba(148,163,184,0.15)" },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 14, family: FONT }, color: PALETTE.textMuted, precision: 0 },
          grid: { color: "rgba(148,163,184,0.2)" },
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
  monthlyCumulative?: Buffer;
}
