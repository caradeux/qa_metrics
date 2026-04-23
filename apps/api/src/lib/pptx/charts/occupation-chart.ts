import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ProjectOccupationCurve } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const WIDTH = 1600;
const HEIGHT = 720;
const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#FFFFFF",
});

export async function buildOccupationChart(
  curve: ProjectOccupationCurve,
  projectName: string,
): Promise<Buffer> {
  const capacityLine = curve.buckets.map((b) => b.capacityHours);

  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: curve.buckets.map((b) => b.label),
      datasets: [
        ...curve.bands.map((band) => ({
          label: band.label,
          data: band.values,
          backgroundColor: `#${band.colorHex}`,
          borderColor: `#${band.colorHex}`,
          fill: true,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.25,
          stack: "occupation",
        })),
        {
          label: "Capacidad contratada",
          data: capacityLine,
          borderColor: `#${PALETTE.textPrimary}`,
          borderDash: [6, 6],
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: `#${PALETTE.textPrimary}`,
          borderWidth: 2,
          stack: "guide",
          tension: 0,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: [`Capacidad ocupada — ${projectName}`, "El equipo permanece siempre productivo"],
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 12, bottom: 18 },
        },
        legend: {
          position: "right",
          labels: {
            font: { size: 13, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            padding: 10,
            boxWidth: 18,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textPrimary}` },
          grid: { display: false },
          stacked: false,
        },
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: { font: { size: 12, family: FONT_FAMILY }, color: `#${PALETTE.textMuted}`, callback: (v) => `${v} h` },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}
