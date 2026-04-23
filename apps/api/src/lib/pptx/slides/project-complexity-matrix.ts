import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData, ComplexityLevel, ComplexityBubble } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

const LEVELS: ComplexityLevel[] = ["LOW", "MEDIUM", "HIGH"];
const LEVEL_LABEL: Record<ComplexityLevel, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };
const LEVEL_SCORE: Record<ComplexityLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function cellFillByScore(score: number): string {
  if (score <= 3) return "D1FAE5";
  if (score === 4) return "FEF3C7";
  if (score === 5) return "FED7AA";
  return "FEE2E2";
}

function cellBorderByScore(score: number): string {
  if (score <= 3) return PALETTE.greenPrimary;
  if (score === 4) return PALETTE.amber;
  if (score === 5) return "FB923C";
  return PALETTE.red;
}

function chipLabel(b: ComplexityBubble): string {
  const match = /^([A-Z0-9-]+)/.exec(b.title);
  if (match && match[1] && match[1].length <= 12) return match[1];
  return b.title.length > 16 ? b.title.slice(0, 15) + "…" : b.title;
}

export function addProjectComplexityMatrixSlide(pres: PptxGenJS, p: ProjectReportData): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText(`Matriz de complejidad — ${p.projectName}`, {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  if (p.complexityBubbles.length === 0) {
    s.addText("(Sin HUs con actividad para graficar)", {
      x: 0.5, y: 3, w: SLIDE.widthIn - 1, h: 1,
      fontFace: FONT.face, fontSize: 16, italic: true, color: PALETTE.textMuted, align: "center",
    });
    return;
  }

  const gridX = 1.8;
  const gridY = 1.3;
  const gridW = 8.5;
  const gridH = 5.3;
  const cellW = gridW / 3;
  const cellH = gridH / 3;

  // Agrupar HUs por combinación (diseño × ejecución).
  const byCell = new Map<string, ComplexityBubble[]>();
  for (const b of p.complexityBubbles) {
    const key = `${b.designComplexity}|${b.executionComplexity}`;
    const arr = byCell.get(key) ?? [];
    arr.push(b);
    byCell.set(key, arr);
  }

  // Dibujar las 9 celdas.
  for (let xi = 0; xi < 3; xi++) {
    for (let yi = 0; yi < 3; yi++) {
      const design = LEVELS[xi]!;
      // Invertir el eje Y: HIGH arriba, LOW abajo.
      const exec = LEVELS[2 - yi]!;
      const score = LEVEL_SCORE[design] + LEVEL_SCORE[exec];
      const cellX = gridX + xi * cellW;
      const cellY = gridY + yi * cellH;

      s.addShape((pres as any).shapes.RECTANGLE, {
        x: cellX, y: cellY, w: cellW, h: cellH,
        fill: { color: cellFillByScore(score) },
        line: { color: cellBorderByScore(score), width: 1 },
      } as any);

      // Chips de HU dentro de la celda.
      const items = byCell.get(`${design}|${exec}`) ?? [];
      if (items.length === 0) continue;

      const chipsPerRow = 3;
      const chipW = (cellW - 0.3) / chipsPerRow;
      const chipH = 0.32;
      const chipGapX = 0.06;
      const chipGapY = 0.08;
      const maxChips = Math.floor((cellH - 0.2) / (chipH + chipGapY)) * chipsPerRow;
      const visible = items.slice(0, Math.max(0, maxChips - (items.length > maxChips ? 1 : 0)));
      const overflow = items.length - visible.length;

      visible.forEach((b, i) => {
        const col = i % chipsPerRow;
        const row = Math.floor(i / chipsPerRow);
        const chipX = cellX + 0.15 + col * (chipW + chipGapX);
        const chipY = cellY + 0.12 + row * (chipH + chipGapY);
        s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
          x: chipX, y: chipY, w: chipW - chipGapX, h: chipH,
          fill: { color: PALETTE.white },
          line: { color: cellBorderByScore(score), width: 0.75 },
          rectRadius: 0.05,
        } as any);
        s.addText(chipLabel(b), {
          x: chipX, y: chipY, w: chipW - chipGapX, h: chipH,
          fontFace: FONT.face, fontSize: 8, color: PALETTE.textPrimary,
          align: "center", valign: "middle",
        });
      });

      if (overflow > 0) {
        const col = visible.length % chipsPerRow;
        const row = Math.floor(visible.length / chipsPerRow);
        const chipX = cellX + 0.15 + col * (chipW + chipGapX);
        const chipY = cellY + 0.12 + row * (chipH + chipGapY);
        s.addText(`+${overflow} más`, {
          x: chipX, y: chipY, w: chipW - chipGapX, h: chipH,
          fontFace: FONT.face, fontSize: 8, italic: true, color: PALETTE.textMuted,
          align: "center", valign: "middle",
        });
      }
    }
  }

  // Etiquetas del eje X (Complejidad de Diseño) debajo del grid.
  LEVELS.forEach((l, xi) => {
    s.addText(LEVEL_LABEL[l], {
      x: gridX + xi * cellW, y: gridY + gridH + 0.05, w: cellW, h: 0.3,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary, align: "center",
    });
  });
  s.addText("Complejidad de Diseño →", {
    x: gridX, y: gridY + gridH + 0.4, w: gridW, h: 0.3,
    fontFace: FONT.face, fontSize: 10, italic: true, color: PALETTE.textMuted, align: "center",
  });

  // Etiquetas del eje Y (Complejidad de Ejecución) a la izquierda.
  LEVELS.forEach((l, yi) => {
    const exec = LEVELS[2 - yi]!;
    s.addText(LEVEL_LABEL[exec], {
      x: gridX - 0.85, y: gridY + yi * cellH, w: 0.8, h: cellH,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary,
      align: "right", valign: "middle",
    });
    void l;
  });
  s.addText("↑ Complejidad de Ejecución", {
    x: 0.2, y: gridY, w: 0.9, h: gridH,
    fontFace: FONT.face, fontSize: 10, italic: true, color: PALETTE.textMuted,
    align: "center", valign: "middle", rotate: 270,
  } as any);

  // Panel derecho: leyenda + Top esfuerzo.
  const rightX = gridX + gridW + 0.4;
  const rightW = SLIDE.widthIn - rightX - 0.4;

  s.addText("Leyenda de riesgo", {
    x: rightX, y: gridY, w: rightW, h: 0.35,
    fontFace: FONT.face, fontSize: 12, bold: true, color: PALETTE.textPrimary,
  });
  const legendItems = [
    { label: "Bajo", score: 2 },
    { label: "Medio-bajo", score: 4 },
    { label: "Medio-alto", score: 5 },
    { label: "Alto", score: 6 },
  ];
  legendItems.forEach((item, i) => {
    const ly = gridY + 0.45 + i * 0.38;
    s.addShape((pres as any).shapes.RECTANGLE, {
      x: rightX, y: ly, w: 0.3, h: 0.25,
      fill: { color: cellFillByScore(item.score) },
      line: { color: cellBorderByScore(item.score), width: 1 },
    } as any);
    s.addText(item.label, {
      x: rightX + 0.4, y: ly - 0.02, w: rightW - 0.4, h: 0.3,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary, valign: "middle",
    });
  });

  // Top 3 esfuerzo acumulado.
  s.addText("Top esfuerzo acumulado", {
    x: rightX, y: gridY + 2.2, w: rightW, h: 0.35,
    fontFace: FONT.face, fontSize: 12, bold: true, color: PALETTE.textPrimary,
  });
  const top3 = [...p.complexityBubbles].sort((a, b) => b.size - a.size).slice(0, 3);
  top3.forEach((b, i) => {
    const cy = gridY + 2.65 + i * 1.0;
    const score = LEVEL_SCORE[b.designComplexity] + LEVEL_SCORE[b.executionComplexity];
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: rightX, y: cy, w: rightW, h: 0.9,
      fill: { color: PALETTE.white },
      line: { color: cellBorderByScore(score), width: 1.25 },
      rectRadius: 0.06,
    } as any);
    s.addText(b.title, {
      x: rightX + 0.1, y: cy + 0.05, w: rightW - 0.2, h: 0.4,
      fontFace: FONT.face, fontSize: 10, bold: true, color: PALETTE.textPrimary,
    });
    s.addText(`${LEVEL_LABEL[b.designComplexity]} × ${LEVEL_LABEL[b.executionComplexity]} · ${b.size} casos`, {
      x: rightX + 0.1, y: cy + 0.45, w: rightW - 0.2, h: 0.4,
      fontFace: FONT.face, fontSize: 9, color: PALETTE.textMuted,
    });
  });
}
