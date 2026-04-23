import type PptxGenJS from "pptxgenjs";
import type { ProjectReportData } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { buildComplexityMatrix } from "../charts/complexity-matrix.js";

export async function addProjectComplexityMatrixSlide(pres: PptxGenJS, p: ProjectReportData): Promise<void> {
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

  const png = await buildComplexityMatrix(p.complexityBubbles);
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.4, y: 1.0, w: 8, h: 5.6 });

  // Top 3 a la derecha.
  s.addText("Top esfuerzo acumulado", {
    x: 8.7, y: 1.1, w: 4.3, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.textPrimary,
  });
  const top3 = [...p.complexityBubbles].sort((a, b) => b.size - a.size).slice(0, 3);
  top3.forEach((b, i) => {
    const y = 1.7 + i * 1.6;
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: 8.7, y, w: 4.3, h: 1.4,
      fill: { color: PALETTE.white }, line: { color: PALETTE.blue, width: 1 }, rectRadius: 0.08,
    } as any);
    s.addText(b.title, {
      x: 8.85, y: y + 0.1, w: 4.1, h: 0.7,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary,
    });
    s.addText(`Diseño ${b.designComplexity} · Ejec. ${b.executionComplexity} · ${b.size} casos`, {
      x: 8.85, y: y + 0.8, w: 4.1, h: 0.5,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textMuted,
    });
  });
}
