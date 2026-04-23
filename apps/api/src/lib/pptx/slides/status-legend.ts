import type PptxGenJS from "pptxgenjs";
import { PALETTE, FONT, SLIDE } from "../theme.js";

interface StatusEntry {
  label: string;
  color: string;
  description: string;
}

const STATUS_LEGEND: StatusEntry[] = [
  {
    label: "No Iniciado",
    color: PALETTE.textMuted,
    description: "La HU fue registrada en el sistema pero aún no se ha iniciado el trabajo.",
  },
  {
    label: "En Diseño",
    color: PALETTE.phaseDesign,
    description: "El analista QA está analizando la HU y escribiendo los casos de prueba.",
  },
  {
    label: "Pdte. Instalación QA",
    color: PALETTE.amber,
    description: "Los casos están listos — esperando que desarrollo despliegue la versión en el ambiente de QA.",
  },
  {
    label: "En Curso",
    color: PALETTE.greenPrimary,
    description: "El analista QA está ejecutando los casos de prueba sobre el ambiente.",
  },
  {
    label: "Devuelto a Desarrollo",
    color: PALETTE.red,
    description: "Se encontraron defectos. La HU volvió al equipo de desarrollo para corrección.",
  },
  {
    label: "Pdte. Aprobación",
    color: PALETTE.purple,
    description: "Los casos fueron enviados al usuario para UAT — esperando que el usuario inicie la revisión.",
  },
  {
    label: "En UAT",
    color: PALETTE.waitingClient,
    description: "El usuario está activamente validando la HU (User Acceptance Testing).",
  },
  {
    label: "En Producción",
    color: PALETTE.greenPrimary,
    description: "La HU fue aprobada por el usuario y liberada a producción.",
  },
  {
    label: "Detenido",
    color: PALETTE.onHold,
    description: "El trabajo sobre la HU está pausado por decisión del cliente, del equipo o por bloqueos externos.",
  },
];

export function addStatusLegendSlide(pres: PptxGenJS): void {
  const s = pres.addSlide();
  s.background = { color: PALETTE.grayLight };

  // Header
  s.addShape((pres as any).shapes.RECTANGLE, {
    x: 0, y: 0, w: SLIDE.widthIn, h: 0.8,
    fill: { color: PALETTE.navyUi }, line: { type: "none" },
  } as any);
  s.addText("Estados del flujo QA — glosario", {
    x: 0.5, y: 0.2, w: SLIDE.widthIn - 1, h: 0.4,
    fontFace: FONT.face, fontSize: 18, bold: true, color: PALETTE.white,
  });

  // Subtítulo
  s.addText("Referencia de los estados que verás en las tablas y gráficos de este informe.", {
    x: 0.5, y: 1.0, w: SLIDE.widthIn - 1, h: 0.35,
    fontFace: FONT.face, fontSize: 12, color: PALETTE.textMuted, align: "center",
  });

  // Grid 3×3
  const cols = 3;
  const rows = 3;
  const gridX = 0.5;
  const gridY = 1.55;
  const gridW = SLIDE.widthIn - 1;
  const gridH = SLIDE.heightIn - gridY - 0.5;
  const gap = 0.15;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;

  STATUS_LEGEND.forEach((entry, i) => {
    if (i >= cols * rows) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (cellW + gap);
    const y = gridY + row * (cellH + gap);

    // Card container
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: PALETTE.white },
      line: { color: "E5E7EB", width: 0.5 },
      rectRadius: 0.06,
    } as any);
    // Colored left edge
    s.addShape((pres as any).shapes.RECTANGLE, {
      x, y, w: 0.1, h: cellH,
      fill: { color: entry.color },
      line: { type: "none" },
    } as any);
    // Chip / label (simulado como rectángulo coloreado con el texto del label)
    s.addShape((pres as any).shapes.ROUNDED_RECTANGLE, {
      x: x + 0.25, y: y + 0.15, w: cellW - 0.45, h: 0.38,
      fill: { color: entry.color },
      line: { type: "none" },
      rectRadius: 0.04,
    } as any);
    s.addText(entry.label, {
      x: x + 0.25, y: y + 0.15, w: cellW - 0.45, h: 0.38,
      fontFace: FONT.face, fontSize: 11, bold: true, color: PALETTE.white,
      align: "center", valign: "middle",
    });
    // Description
    s.addText(entry.description, {
      x: x + 0.25, y: y + 0.62, w: cellW - 0.45, h: cellH - 0.72,
      fontFace: FONT.face, fontSize: 10, color: PALETTE.textPrimary,
      valign: "top",
    });
  });
}
