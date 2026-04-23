import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "../theme.js";

export function addAppendixDividerSlide(pres: PptxGenJS): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.navyDeep };
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: SLIDE.heightIn / 2 - 0.1, w: SLIDE.widthIn, h: 0.05,
    fill: { color: PALETTE.greenPrimary }, line: { type: "none" },
  } as any);
  s.addText("ANEXO", {
    x: 0, y: SLIDE.heightIn / 2 - 1.5, w: SLIDE.widthIn, h: 1,
    fontFace: FONT.face, fontSize: 64, bold: true, color: PALETTE.greenLight, align: "center",
  });
  s.addText("Detalle interno de operación", {
    x: 0, y: SLIDE.heightIn / 2 + 0.2, w: SLIDE.widthIn, h: 0.8,
    fontFace: FONT.face, fontSize: 24, color: PALETTE.grayLight, align: "center",
  });
}
