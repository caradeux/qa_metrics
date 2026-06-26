import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "./theme.js";

// ─────────────────────────────────────────────────────────────────────────────
// Componentes visuales reutilizables del deck. Centralizan el estilo para que
// todos los slides se vean consistentes (mismo lenguaje de tarjetas, header,
// barra de flujo). Reemplazan los estilos sueltos/planos que había antes.
// ─────────────────────────────────────────────────────────────────────────────

/** Banda de encabezado navy estándar + título (y subtítulo opcional a la derecha). */
export function slideHeader(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  title: string,
  opts?: { rightText?: string; rightColor?: string; h?: number; fill?: string },
): void {
  const h = opts?.h ?? 0.85;
  slide.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h,
    fill: { color: opts?.fill ?? PALETTE.navyUi }, line: { type: "none" },
  } as any);
  // Acento verde Inovabiz a la izquierda del header.
  slide.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h,
    fill: { color: PALETTE.greenPrimary }, line: { type: "none" },
  } as any);
  slide.addText(title, {
    x: 0.5, y: 0, w: SLIDE.widthIn - 5, h,
    fontFace: FONT.face, fontSize: 20, bold: true, color: PALETTE.white, valign: "middle",
  } as any);
  if (opts?.rightText) {
    slide.addText(opts.rightText, {
      x: SLIDE.widthIn - 5, y: 0, w: 4.5, h,
      fontFace: FONT.face, fontSize: 13, color: opts.rightColor ?? PALETTE.greenLight,
      align: "right", valign: "middle",
    } as any);
  }
}

/** Tarjeta KPI refinada: blanca + sombra suave + franja de acento superior. */
export function statCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  o: {
    x: number; y: number; w: number; h: number;
    value: string; label: string; accent: string; // accent hex sin '#'
    valueSize?: number; labelSize?: number;
  },
): void {
  slide.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: PALETTE.white }, line: { color: "E5E7EB", width: 0.75 }, rectRadius: 0.09,
    shadow: { type: "outer", color: "94A3B8", opacity: 0.25, offset: 2, blur: 7, angle: 90 },
  } as any);
  // Franja de acento superior (centrada, no toca las esquinas redondeadas).
  slide.addShape((pres as any).shapes.RECTANGLE, {
    x: o.x + 0.14, y: o.y, w: o.w - 0.28, h: 0.09,
    fill: { color: o.accent }, line: { type: "none" },
  } as any);
  slide.addText(o.value, {
    x: o.x, y: o.y + 0.2, w: o.w, h: o.h * 0.52,
    fontFace: FONT.face, fontSize: o.valueSize ?? 38, bold: true, color: `#${o.accent}`,
    align: "center", valign: "middle",
  } as any);
  slide.addText(o.label, {
    x: o.x + 0.12, y: o.y + o.h * 0.64, w: o.w - 0.24, h: o.h * 0.3,
    fontFace: FONT.face, fontSize: o.labelSize ?? 11.5, color: PALETTE.textMuted,
    align: "center", valign: "top",
  } as any);
}

/** Barra de flujo apilada horizontal (pipeline) con count/% dentro de cada segmento. */
export function flowBar(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  o: {
    x: number; y: number; w: number; h: number;
    items: Array<{ label: string; count: number; colorHex: string }>;
    total: number;
  },
): void {
  // Fondo (cubre redondeos / segmentos chicos).
  slide.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: "E5E7EB" }, line: { type: "none" }, rectRadius: 0.07,
  } as any);
  let cursor = o.x;
  for (const item of o.items) {
    const segW = (item.count / (o.total || 1)) * o.w;
    if (segW < 0.01) continue;
    slide.addShape((pres as any).shapes.RECTANGLE, {
      x: cursor, y: o.y, w: segW, h: o.h,
      fill: { color: item.colorHex }, line: { color: PALETTE.white, width: 1.25 },
    } as any);
    const pct = Math.round((item.count / (o.total || 1)) * 100);
    if (segW >= 0.85) {
      slide.addText(`${item.count}`, {
        x: cursor, y: o.y + o.h * 0.12, w: segW, h: o.h * 0.5,
        fontFace: FONT.face, fontSize: 20, bold: true, color: PALETTE.white,
        align: "center", valign: "middle",
      } as any);
      slide.addText(`${pct}%`, {
        x: cursor, y: o.y + o.h * 0.55, w: segW, h: o.h * 0.35,
        fontFace: FONT.face, fontSize: 10, color: PALETTE.white, align: "center", valign: "middle",
      } as any);
    } else if (segW >= 0.4) {
      slide.addText(`${item.count}`, {
        x: cursor, y: o.y, w: segW, h: o.h,
        fontFace: FONT.face, fontSize: 13, bold: true, color: PALETTE.white,
        align: "center", valign: "middle",
      } as any);
    }
    cursor += segW;
  }
}

/** Mini-tarjeta de estado: borde lateral de color + número + etiqueta + sub. */
export function legendCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  o: { x: number; y: number; w: number; h: number; value: string; label: string; sub?: string; accent: string },
): void {
  slide.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: PALETTE.white }, line: { color: "E5E7EB", width: 0.5 }, rectRadius: 0.06,
    shadow: { type: "outer", color: "94A3B8", opacity: 0.18, offset: 1, blur: 4, angle: 90 },
  } as any);
  slide.addShape((pres as any).shapes.RECTANGLE, {
    x: o.x, y: o.y, w: 0.12, h: o.h, fill: { color: o.accent }, line: { type: "none" },
  } as any);
  slide.addText(o.value, {
    x: o.x + 0.28, y: o.y + 0.12, w: o.w - 0.4, h: o.h * 0.45,
    fontFace: FONT.face, fontSize: 28, bold: true, color: `#${o.accent}`, align: "left", valign: "middle",
  } as any);
  slide.addText(o.label, {
    x: o.x + 0.28, y: o.y + o.h * 0.55, w: o.w - 0.4, h: o.h * 0.24,
    fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary, align: "left",
  } as any);
  if (o.sub) {
    slide.addText(o.sub, {
      x: o.x + 0.28, y: o.y + o.h * 0.76, w: o.w - 0.4, h: o.h * 0.22,
      fontFace: FONT.face, fontSize: 9, color: PALETTE.textMuted, align: "left",
    } as any);
  }
}
