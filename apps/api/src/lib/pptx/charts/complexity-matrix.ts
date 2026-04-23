import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { ComplexityBubble, ComplexityLevel } from "../types.js";
import { PALETTE, FONT } from "../theme.js";

const WIDTH = 1200;
const HEIGHT = 800;
const FONT_FAMILY = `${FONT.face}, ${FONT.fallback}`;

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#FFFFFF",
});

const LEVELS: ComplexityLevel[] = ["LOW", "MEDIUM", "HIGH"];

function levelToAxis(l: ComplexityLevel): number {
  return LEVELS.indexOf(l) + 1;
}

function jitter(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 200) / 1000) - 0.1; // ±0.1
}

export async function buildComplexityMatrix(bubbles: ComplexityBubble[]): Promise<Buffer> {
  const minSize = 8;
  const maxSize = 52;
  const maxVal = Math.max(...bubbles.map((b) => b.size), 1);
  const points = bubbles.map((b) => ({
    x: levelToAxis(b.designComplexity) + jitter(b.storyId),
    y: levelToAxis(b.executionComplexity) + jitter(`${b.storyId}y`),
    r: Math.max(minSize, (b.size / maxVal) * maxSize),
    label: b.title,
  }));

  const config: ChartConfiguration<"bubble"> = {
    type: "bubble",
    data: {
      datasets: [
        {
          label: "HUs",
          data: points,
          backgroundColor: `rgba(8, 172, 244, 0.55)`,
          borderColor: `#${PALETTE.blue}`,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Matriz de complejidad por HU (Diseño × Ejecución)",
          font: { size: 22, weight: "bold", family: FONT_FAMILY },
          color: `#${PALETTE.textPrimary}`,
          padding: { top: 12, bottom: 18 },
        },
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          min: 0.5, max: 3.5,
          ticks: {
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            callback: (v) => LEVELS[Number(v) - 1] ?? "",
            stepSize: 1,
          },
          title: {
            display: true,
            text: "Complejidad de Diseño",
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
          },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
        y: {
          min: 0.5, max: 3.5,
          ticks: {
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
            callback: (v) => LEVELS[Number(v) - 1] ?? "",
            stepSize: 1,
          },
          title: {
            display: true,
            text: "Complejidad de Ejecución",
            font: { size: 14, family: FONT_FAMILY },
            color: `#${PALETTE.textPrimary}`,
          },
          grid: { color: "rgba(107, 114, 128, 0.18)" },
        },
      },
    },
  };
  return canvas.renderToBuffer(config, "image/png");
}
