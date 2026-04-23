import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "../theme.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolver desde apps/api/src/lib/pptx/slides (dev con tsx) o apps/api/dist/lib/pptx/slides (prod)
// a apps/api/assets/inovabiz-logo.svg — 4 niveles arriba, luego assets/.
const LOGO_PATH = join(__dirname, "..", "..", "..", "..", "assets", "inovabiz-logo.svg");

export function addClosingSlide(pres: PptxGenJS): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };

  const svg = readFileSync(LOGO_PATH, "utf-8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  s.addImage({ data: dataUri, x: (SLIDE.widthIn - 4) / 2, y: 2.3, w: 4, h: 0.49 });

  // Marca "QA Metrics by Inovabiz" bajo el logo.
  s.addText("QA Metrics by Inovabiz", {
    x: 0, y: 2.95, w: SLIDE.widthIn, h: 0.4,
    fontFace: FONT.face, fontSize: 16, bold: true, color: PALETTE.greenLight, align: "center",
    charSpacing: 1,
  });

  s.addText("Gracias", {
    x: 0, y: 3.8, w: SLIDE.widthIn, h: 1,
    fontFace: FONT.face, fontSize: 56, bold: true, color: PALETTE.white, align: "center",
  });
  s.addText("contacto@inovabiz.com · inovabiz.com", {
    x: 0, y: 5.0, w: SLIDE.widthIn, h: 0.5,
    fontFace: FONT.face, fontSize: 14, color: PALETTE.cyan, align: "center",
  });
}
