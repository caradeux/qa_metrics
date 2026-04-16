// pptxgenjs exporta su clase como CJS `module.exports = PptxGenJS`. Bajo ESM
// el default viene envuelto; caemos al objeto módulo si default no existe.
import pptxgenModule from "pptxgenjs";
const PptxGenJS: any = (pptxgenModule as any).default ?? pptxgenModule;
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mapeo estado interno → label cliente-facing (confirmado por Líder QA 2026-04-16)
const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "No Iniciado",
  ANALYSIS: "En Diseño",
  TEST_DESIGN: "En Diseño",
  WAITING_QA_DEPLOY: "Pdte. Instalación QA",
  EXECUTION: "En Curso",
  RETURNED_TO_DEV: "Devuelto a Desarrollo",
  WAITING_UAT: "Pdte. Aprobación",
  UAT: "Pdte. Aprobación",
  PRODUCTION: "Completado",
  ON_HOLD: "Detenido",
};

// Paleta corporativa InovaBiz (derivada del PPTX original)
const COLORS = {
  navy: "1F3864",
  blue: "2E5FA3",
  lightBlue: "4A90D9",
  white: "FFFFFF",
  textDark: "1F3864",
  textMuted: "6B7280",
  tableHeaderBg: "1F3864",
  tableRowEven: "F5F7FA",
  tableRowOdd: "FFFFFF",
  borderSubtle: "E5E7EB",
};

export interface WeeklyHU {
  title: string;
  status: string;           // estado interno (REGISTERED, EXECUTION, etc.)
  designed: number | null;
  executed: number | null;
  defects: number | null;
}

export interface WeeklyProjectSlide {
  projectName: string;
  clientName: string;
  projectManagerName: string | null;
  testerName: string | null;
  testerAllocation: number | null;
  hus: WeeklyHU[];
}

export interface WeeklyPptxInput {
  weekStart: Date;  // lunes
  weekEnd: Date;    // viernes
  projects: WeeklyProjectSlide[];
}

function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return String(n);
}

function formatWeekRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const d1 = format(start, "d", { locale: es });
  const d2 = format(end, "d", { locale: es });
  const m1 = format(start, "MMMM", { locale: es });
  const m2 = format(end, "MMMM", { locale: es });
  const y = format(end, "yyyy", { locale: es });
  if (sameMonth && sameYear) return `${d1} al ${d2} de ${m1} ${y}`;
  if (sameYear) return `${d1} ${m1} al ${d2} ${m2} ${y}`;
  return `${format(start, "d MMM yyyy", { locale: es })} al ${format(end, "d MMM yyyy", { locale: es })}`;
}

function labelFor(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export async function buildWeeklyPptxBuffer(input: WeeklyPptxInput): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pres.title = "Seguimiento Semanal QA";
  pres.company = "InovaBiz";

  const SLIDE_W = 13.33;
  const SLIDE_H = 7.5;

  // ── Slide 1 — Portada ──
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.navy };
    // Barra lateral azul claro
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 0.35, h: SLIDE_H,
      fill: { color: COLORS.lightBlue }, line: { color: COLORS.lightBlue },
    });
    s.addText("Seguimiento", {
      x: 1, y: 2.4, w: 11, h: 0.9,
      fontSize: 48, bold: true, color: COLORS.white, fontFace: "Calibri",
    });
    s.addText("Semanal QA", {
      x: 1, y: 3.2, w: 11, h: 0.9,
      fontSize: 48, bold: true, color: COLORS.lightBlue, fontFace: "Calibri",
    });
    s.addShape(pres.ShapeType.rect, {
      x: 1, y: 4.3, w: 1.2, h: 0.04,
      fill: { color: COLORS.lightBlue }, line: { color: COLORS.lightBlue },
    });
    s.addText("Aseguramiento de Calidad & Seguridad | InovaBiz", {
      x: 1, y: 4.5, w: 11, h: 0.4,
      fontSize: 14, color: COLORS.white, fontFace: "Calibri",
    });
    s.addText(format(input.weekEnd, "yyyy"), {
      x: 1, y: 5.0, w: 4, h: 0.6,
      fontSize: 28, bold: true, color: COLORS.lightBlue, fontFace: "Calibri",
    });
    s.addText(formatWeekRange(input.weekStart, input.weekEnd), {
      x: 1, y: 5.8, w: 10, h: 0.4,
      fontSize: 14, color: "A0B4D3", fontFace: "Calibri", italic: true,
    });
    s.addText("DOCUMENTO CONFIDENCIAL", {
      x: 1, y: SLIDE_H - 0.6, w: 11, h: 0.3,
      fontSize: 9, color: "8FA5C4", fontFace: "Calibri",
      charSpacing: 4,
    });
  }

  // ── Slides por proyecto ──
  for (const p of input.projects) {
    const s = pres.addSlide();
    s.background = { color: COLORS.white };

    // Barra lateral navy
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 0.35, h: SLIDE_H,
      fill: { color: COLORS.navy }, line: { color: COLORS.navy },
    });

    // Título proyecto
    s.addText(p.projectName, {
      x: 0.7, y: 0.35, w: 12, h: 0.8,
      fontSize: 32, bold: true, color: COLORS.navy, fontFace: "Calibri",
    });
    // Subtítulo cliente
    s.addText(p.clientName, {
      x: 0.7, y: 1.0, w: 12, h: 0.35,
      fontSize: 12, color: COLORS.textMuted, fontFace: "Calibri",
    });

    // ── Bloque EQUIPO (izquierda) ──
    s.addShape(pres.ShapeType.rect, {
      x: 0.7, y: 1.7, w: 4.2, h: 0.4,
      fill: { color: COLORS.navy }, line: { color: COLORS.navy },
    });
    s.addText("EQUIPO", {
      x: 0.7, y: 1.7, w: 4.2, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.white, align: "center",
      valign: "middle", fontFace: "Calibri", charSpacing: 3,
    });
    s.addShape(pres.ShapeType.rect, {
      x: 0.7, y: 2.1, w: 4.2, h: 2.0,
      fill: { color: "F5F7FA" }, line: { color: COLORS.borderSubtle },
    });
    const equipoText = [
      { text: "Jefe de Proyecto: ", options: { bold: true, color: COLORS.navy } },
      { text: (p.projectManagerName ?? "—") + "\n", options: { color: COLORS.textDark } },
      { text: "Analista QA: ", options: { bold: true, color: COLORS.navy } },
      { text: (p.testerName ?? "—") + "\n", options: { color: COLORS.textDark } },
      { text: "Asignación: ", options: { bold: true, color: COLORS.navy } },
      { text: p.testerAllocation !== null ? `${p.testerAllocation}%` : "—", options: { color: COLORS.textDark } },
    ];
    s.addText(equipoText, {
      x: 0.9, y: 2.25, w: 3.9, h: 1.8,
      fontSize: 13, fontFace: "Calibri", valign: "top",
    });

    // ── Bloque OBSERVACIONES (derecha del equipo) ──
    s.addShape(pres.ShapeType.rect, {
      x: 5.1, y: 1.7, w: 7.5, h: 0.4,
      fill: { color: COLORS.blue }, line: { color: COLORS.blue },
    });
    s.addText("OBSERVACIONES", {
      x: 5.1, y: 1.7, w: 7.5, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.white, align: "center",
      valign: "middle", fontFace: "Calibri", charSpacing: 3,
    });
    s.addShape(pres.ShapeType.rect, {
      x: 5.1, y: 2.1, w: 7.5, h: 2.0,
      fill: { color: "F5F7FA" }, line: { color: COLORS.borderSubtle },
    });
    s.addText("[Escribe aquí las observaciones de la semana]", {
      x: 5.3, y: 2.25, w: 7.1, h: 1.8,
      fontSize: 12, color: "9CA3AF", italic: true, fontFace: "Calibri", valign: "top",
    });

    // ── MÉTRICAS POR HU (abajo) ──
    s.addShape(pres.ShapeType.rect, {
      x: 0.7, y: 4.4, w: 11.9, h: 0.4,
      fill: { color: COLORS.lightBlue }, line: { color: COLORS.lightBlue },
    });
    s.addText(`MÉTRICAS POR HISTORIA DE USUARIO — ${p.projectName.toUpperCase()}`, {
      x: 0.7, y: 4.4, w: 11.9, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.white, align: "center",
      valign: "middle", fontFace: "Calibri", charSpacing: 2,
    });

    const headers = [
      { text: "Historia de Usuario", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tableHeaderBg }, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const } },
      { text: "Estado", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tableHeaderBg }, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const } },
      { text: "Casos Diseñados", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tableHeaderBg }, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const } },
      { text: "Casos Ejecutados", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tableHeaderBg }, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const } },
      { text: "Bugs Detectados", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tableHeaderBg }, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const } },
    ];

    const dataRows = p.hus.length === 0
      ? [[
          { text: "(Sin HU con actividad esta semana)", options: { color: COLORS.textMuted, italic: true, fontFace: "Calibri", fontSize: 11, align: "center" as const, colspan: 5 } },
        ]]
      : p.hus.map((hu, idx) => [
          { text: hu.title, options: { color: COLORS.textDark, fontFace: "Calibri", fontSize: 11, align: "left" as const, valign: "middle" as const, fill: { color: idx % 2 === 0 ? COLORS.tableRowOdd : COLORS.tableRowEven } } },
          { text: labelFor(hu.status), options: { color: COLORS.textDark, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const, fill: { color: idx % 2 === 0 ? COLORS.tableRowOdd : COLORS.tableRowEven } } },
          { text: fmtNum(hu.designed), options: { color: COLORS.textDark, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const, fill: { color: idx % 2 === 0 ? COLORS.tableRowOdd : COLORS.tableRowEven } } },
          { text: fmtNum(hu.executed), options: { color: COLORS.textDark, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const, fill: { color: idx % 2 === 0 ? COLORS.tableRowOdd : COLORS.tableRowEven } } },
          { text: fmtNum(hu.defects), options: { color: COLORS.textDark, fontFace: "Calibri", fontSize: 11, align: "center" as const, valign: "middle" as const, fill: { color: idx % 2 === 0 ? COLORS.tableRowOdd : COLORS.tableRowEven } } },
        ]);

    s.addTable([headers, ...dataRows] as any, {
      x: 0.7, y: 4.8, w: 11.9,
      colW: [5.7, 2.4, 1.2, 1.3, 1.3],
      rowH: 0.4,
      border: { type: "solid", pt: 0.5, color: COLORS.borderSubtle },
      fontFace: "Calibri",
    });

    // Fecha abajo derecha
    s.addText(formatWeekRange(input.weekStart, input.weekEnd), {
      x: 8.5, y: SLIDE_H - 0.5, w: 4.3, h: 0.35,
      fontSize: 10, color: COLORS.textMuted, italic: true, align: "right", fontFace: "Calibri",
    });
  }

  // ── Slide final — Despedida ──
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.navy };
    s.addText("Gracias", {
      x: 1, y: 2.8, w: 11, h: 1.5,
      fontSize: 80, bold: true, color: COLORS.white, fontFace: "Calibri", align: "center",
    });
    s.addShape(pres.ShapeType.rect, {
      x: 5.5, y: 4.3, w: 2.3, h: 0.04,
      fill: { color: COLORS.lightBlue }, line: { color: COLORS.lightBlue },
    });
    s.addText("contacto@inovabiz.com  |  www.inovabiz.com  |  +562 2269 0490", {
      x: 1, y: 4.6, w: 11, h: 0.4,
      fontSize: 14, color: "A0B4D3", fontFace: "Calibri", align: "center",
    });
    s.addText("INNOVATION & BUSINESS", {
      x: 1, y: SLIDE_H - 0.6, w: 11, h: 0.3,
      fontSize: 10, color: "8FA5C4", fontFace: "Calibri", align: "center", charSpacing: 6,
    });
  }

  // pptxgenjs devuelve Promise<string | Buffer | Blob>. Forzar base64 → Buffer.
  const base64 = (await pres.write({ outputType: "base64" })) as string;
  return Buffer.from(base64, "base64");
}
