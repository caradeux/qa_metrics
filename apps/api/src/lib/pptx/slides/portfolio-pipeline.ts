import type PptxGenJS from "pptxgenjs";
import type { ReportSpec, ProjectPipeline } from "../types.js";
import { PALETTE, FONT, SLIDE } from "../theme.js";

// Orden narrativo del flujo QA (izq → der sigue la vida del trabajo).
const STATE_ORDER = [
  "No Iniciado",
  "En Diseño",
  "Pdte. Instalación QA",
  "En Curso",
  "Devuelto a Desarrollo",
  "Pdte. Aprobación",
  "En UAT",
  "En Producción",
  "Detenido",
];

function sortByFlow(pipeline: ProjectPipeline[]): ProjectPipeline[] {
  const byLabel = new Map(pipeline.map((p) => [p.label, p]));
  const sorted: ProjectPipeline[] = [];
  for (const lbl of STATE_ORDER) {
    const found = byLabel.get(lbl);
    if (found) sorted.push(found);
  }
  // Estados que no estén en STATE_ORDER (defensivo).
  for (const p of pipeline) {
    if (!STATE_ORDER.includes(p.label)) sorted.push(p);
  }
  return sorted;
}

export function addPortfolioPipelineSlide(pres: PptxGenJS, spec: ReportSpec): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header.
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText("Pipeline consolidado del portafolio", {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  const pipeline = sortByFlow(spec.portfolio.pipeline.filter((p) => p.count > 0));
  const total = pipeline.reduce((s, p) => s + p.count, 0);

  if (total === 0) {
    s.addText("(Sin historias de usuario en seguimiento)", {
      x: 0.5, y: 3, w: SLIDE.widthIn - 1, h: 1,
      fontFace: FONT.face, fontSize: 16, italic: true, color: PALETTE.textMuted, align: "center",
    });
    return;
  }

  // Subtítulo con total.
  s.addText(`${total} historias de usuario en seguimiento · distribución por estado del flujo QA`, {
    x: 0.5, y: 1.0, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 13, color: PALETTE.textMuted, align: "center",
  });

  // ── Barra apilada horizontal ──
  const barX = 0.7;
  const barY = 1.8;
  const barW = SLIDE.widthIn - 1.4;
  const barH = 1.1;

  // Fondo (por si segmentos no cubren el 100% por redondeos).
  s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
    x: barX, y: barY, w: barW, h: barH,
    fill: { color: "E5E7EB" },
    line: { type: "none" },
    rectRadius: 0.08,
  } as any);

  let cursor = barX;
  for (let i = 0; i < pipeline.length; i++) {
    const item = pipeline[i]!;
    const segW = (item.count / total) * barW;
    if (segW < 0.01) continue;

    s.addShape((pres as any).shapes.RECTANGLE, {
      x: cursor, y: barY, w: segW, h: barH,
      fill: { color: item.colorHex },
      line: { color: PALETTE.white, width: 1 },
    } as any);

    const pct = Math.round((item.count / total) * 100);
    // Texto dentro del segmento si hay espacio mínimo (≥ 0.9 in).
    if (segW >= 0.9) {
      s.addText(`${item.count}`, {
        x: cursor, y: barY + 0.12, w: segW, h: 0.45,
        fontFace: FONT.face, fontSize: 22, bold: true, color: PALETTE.white,
        align: "center", valign: "middle",
      });
      s.addText(`${pct}%`, {
        x: cursor, y: barY + 0.6, w: segW, h: 0.4,
        fontFace: FONT.face, fontSize: 11, color: PALETTE.white,
        align: "center", valign: "middle",
      });
    } else if (segW >= 0.45) {
      // Solo count.
      s.addText(`${item.count}`, {
        x: cursor, y: barY, w: segW, h: barH,
        fontFace: FONT.face, fontSize: 14, bold: true, color: PALETTE.white,
        align: "center", valign: "middle",
      });
    }
    cursor += segW;
  }

  // Ajuste: el último segmento extiende al borde exacto para evitar gap por redondeo.
  // (ya no necesario porque cursor termina ~barX+barW; si faltara, no importa visualmente.)

  // ── Mini-cards debajo de la barra ──
  const cardsY = 3.3;
  const cardsAvailableW = SLIDE.widthIn - 1.0;
  const cols = Math.min(4, pipeline.length);
  const rows = Math.ceil(pipeline.length / cols);
  const gap = 0.2;
  const cardW = (cardsAvailableW - gap * (cols - 1)) / cols;
  const cardH = 1.4;

  pipeline.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 0.5 + col * (cardW + gap);
    const cy = cardsY + row * (cardH + 0.2);
    const pct = Math.round((item.count / total) * 100);

    // Card fondo blanco con borde izquierdo grueso coloreado.
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: cx, y: cy, w: cardW, h: cardH,
      fill: { color: PALETTE.white },
      line: { color: "E5E7EB", width: 0.5 },
      rectRadius: 0.06,
      shadow: { type: "outer", color: "6B7280", opacity: 0.12, offset: 1, blur: 4, angle: 90 },
    } as any);
    // Barra lateral de color (indicador de estado).
    s.addShape((pres as any).shapes.RECTANGLE, {
      x: cx, y: cy, w: 0.12, h: cardH,
      fill: { color: item.colorHex },
      line: { type: "none" },
    } as any);

    // Conteo grande.
    s.addText(String(item.count), {
      x: cx + 0.25, y: cy + 0.12, w: cardW - 0.35, h: 0.6,
      fontFace: FONT.face, fontSize: 32, bold: true, color: item.colorHex,
      align: "left", valign: "middle",
    });
    // Nombre del estado.
    s.addText(item.label, {
      x: cx + 0.25, y: cy + 0.75, w: cardW - 0.35, h: 0.35,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.textPrimary,
      align: "left",
    });
    // Porcentaje.
    s.addText(`${pct}% del total`, {
      x: cx + 0.25, y: cy + 1.05, w: cardW - 0.35, h: 0.3,
      fontFace: FONT.face, fontSize: 9, color: PALETTE.textMuted,
      align: "left",
    });
  });

  // Footer narrativo.
  s.addText("La barra superior muestra el flujo del trabajo QA de izquierda a derecha: desde lo no iniciado hasta lo completado.", {
    x: 0.5, y: SLIDE.heightIn - 0.5, w: SLIDE.widthIn - 1, h: 0.35,
    fontFace: FONT.face, fontSize: 10, italic: true, color: PALETTE.textMuted, align: "center",
  });
}
