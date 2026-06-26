import type PptxGenJS from "pptxgenjs";
import type { ReportSpec } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolver desde apps/api/src/lib/pptx/slides (dev con tsx) o apps/api/dist/lib/pptx/slides (prod)
// a apps/api/assets/inovabiz-logo.svg — 4 niveles arriba, luego assets/.
const LOGO_PATH = join(__dirname, "..", "..", "..", "..", "assets", "inovabiz-logo.svg");

export function addCoverSlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };

  // Motivo de marca: círculos tenues en la esquina inferior derecha (dan
  // profundidad sin recargar). Se dibujan primero para quedar detrás.
  s.addShape((pres as any).shapes.OVAL, {
    x: 8.6, y: 3.2, w: 6.0, h: 6.0,
    fill: { color: PALETTE.cyan, transparency: 93 }, line: { type: "none" },
  } as any);
  s.addShape((pres as any).shapes.OVAL, {
    x: 10.2, y: 4.4, w: 4.4, h: 4.4,
    fill: { color: PALETTE.greenPrimary, transparency: 90 }, line: { type: "none" },
  } as any);
  s.addShape((pres as any).shapes.OVAL, {
    x: 11.6, y: 5.4, w: 2.6, h: 2.6,
    fill: { color: PALETTE.blue, transparency: 88 }, line: { type: "none" },
  } as any);

  // Franja vertical verde (gradient simulado por rect sólido).
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.45, h: SLIDE.heightIn,
    fill: { color: PALETTE.greenPrimary },
    line: { type: "none" },
  } as any);

  // Logo Inovabiz (SVG convertido a data URI).
  const svg = readFileSync(LOGO_PATH, "utf-8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  s.addImage({ data: dataUri, x: 0.9, y: 0.5, w: 2.4, h: 0.29 });

  // Marca "QA Metrics by Inovabiz".
  s.addText("QA Metrics by Inovabiz", {
    x: 0.9, y: 0.9, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.cyan,
    charSpacing: 1,
  });

  // Título.
  s.addText("Informe de Avance QA", {
    x: 0.9, y: 2.2, w: SLIDE.widthIn - 1.8, h: 1.0,
    fontFace: FONT.face, fontSize: 44, bold: true, color: PALETTE.white,
  });

  // Regla de acento bajo el título.
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0.95, y: 3.25, w: 1.5, h: 0.06,
    fill: { color: PALETTE.greenPrimary }, line: { type: "none" },
  } as any);

  // Subtítulo: periodo.
  s.addText(spec.periodLabel, {
    x: 0.9, y: 3.5, w: SLIDE.widthIn - 1.8, h: 0.7,
    fontFace: FONT.face, fontSize: 24, color: PALETTE.grayLight,
  });

  // Cliente (si aplica).
  if (spec.clientFilter) {
    s.addText(`Cliente: ${spec.clientFilter.name}`, {
      x: 0.9, y: 4.45, w: SLIDE.widthIn - 1.8, h: 0.5,
      fontFace: FONT.face, fontSize: 16, color: PALETTE.cyan,
    });
  }

  // Teaser de métricas del portafolio.
  const tk = spec.portfolio?.kpis;
  if (tk) {
    s.addText(
      [
        { text: `${tk.totalProjects} `, options: { bold: true, color: PALETTE.white } },
        { text: tk.totalProjects === 1 ? "proyecto" : "proyectos", options: { color: PALETTE.grayLight } },
        { text: "      ", options: {} },
        { text: `${tk.totalAnalysts} `, options: { bold: true, color: PALETTE.white } },
        { text: tk.totalAnalysts === 1 ? "analista" : "analistas", options: { color: PALETTE.grayLight } },
      ] as any,
      { x: 0.9, y: 5.25, w: SLIDE.widthIn - 1.8, h: 0.4, fontFace: FONT.face, fontSize: 14 },
    );
  }

  // Footer.
  s.addText("Preparado por Inovabiz", {
    x: 0.9, y: SLIDE.heightIn - 0.8, w: 6, h: 0.4,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.greenLight,
  });
  s.addText(new Date().toLocaleDateString("es-CL"), {
    x: SLIDE.widthIn - 2.5, y: SLIDE.heightIn - 0.8, w: 2, h: 0.4,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.grayLight, align: "right",
  });
}
