// pptxgenjs exporta su clase como CJS `module.exports = PptxGenJS`. Bajo ESM
// el default viene envuelto; caemos al objeto módulo si default no existe.
import pptxgenModule from "pptxgenjs";
const PptxGenJS: any = (pptxgenModule as any).default ?? pptxgenModule;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Paleta corporativa derivada del PPTX original (InovaBiz 2026)
const C = {
  navyDark: "0F172A",     // fondo portada y despedida
  navy: "1E293B",          // texto dark alternativo
  cyanAccent: "06B6D4",    // acento cyan
  greenAccent: "22C55E",   // acento verde
  blueHeader: "1A5276",    // header EQUIPO
  blueMid: "2D8DBB",       // header OBSERVACIONES
  white: "FFFFFF",
  softGray: "F8FAFC",      // fondo bloques claros
  lightBlueTint: "EBF4FB", // row alterna tabla
  lighterBlueTint: "D6EAF8",
  textMuted: "64748B",
  textDark: "1E293B",
  textLight: "94A3B8",
  borderSubtle: "E5E7EB",
};

// Logo InovaBiz (portada y despedida). Resolviendo al momento de carga del módulo.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// apps/api/src/lib -> ../../assets
const LOGO_PATH = join(__dirname, "..", "..", "assets", "logo-inovabiz.png");
let logoDataUrl: string | null = null;
try {
  const buf = readFileSync(LOGO_PATH);
  logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
} catch {
  logoDataUrl = null;
}

export interface WeeklyHU {
  title: string;
  status: string;
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
  weekStart: Date;
  weekEnd: Date;
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

  // ══════ Slide 1 — Portada ══════
  {
    const s = pres.addSlide();
    s.background = { color: C.navyDark };

    // Logo arriba-izquierda
    if (logoDataUrl) {
      s.addImage({ data: logoDataUrl, x: 0.6, y: 0.5, w: 2.2, h: 0.43 });
    }

    // Barra de acento cyan vertical
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 0.18, h: SLIDE_H,
      fill: { color: C.cyanAccent }, line: { color: C.cyanAccent },
    });

    // Título principal (3 líneas)
    s.addText("Seguimiento", {
      x: 0.8, y: 2.3, w: 12, h: 0.9,
      fontSize: 46, bold: true, color: C.white, fontFace: "Arial",
    });
    s.addText("Semanal QA", {
      x: 0.8, y: 3.05, w: 12, h: 0.9,
      fontSize: 46, bold: true, color: C.cyanAccent, fontFace: "Arial",
    });

    // Divider
    s.addShape(pres.ShapeType.rect, {
      x: 0.85, y: 4.18, w: 1.3, h: 0.05,
      fill: { color: C.greenAccent }, line: { color: C.greenAccent },
    });

    s.addText("Aseguramiento de Calidad & Seguridad | InovaBiz", {
      x: 0.8, y: 4.4, w: 11, h: 0.4,
      fontSize: 14, color: C.textLight, fontFace: "Arial",
    });

    s.addText(format(input.weekEnd, "yyyy"), {
      x: 0.8, y: 5.0, w: 4, h: 0.7,
      fontSize: 36, bold: true, color: C.cyanAccent, fontFace: "Arial",
    });

    s.addText(formatWeekRange(input.weekStart, input.weekEnd), {
      x: 0.8, y: 5.9, w: 10, h: 0.4,
      fontSize: 14, color: C.textLight, fontFace: "Arial", italic: true,
    });

    s.addText("DOCUMENTO CONFIDENCIAL", {
      x: 0.8, y: SLIDE_H - 0.55, w: 12, h: 0.3,
      fontSize: 9, color: C.textMuted, fontFace: "Arial",
      charSpacing: 4,
    });
  }

  // ══════ Slides por proyecto ══════
  for (const p of input.projects) {
    const s = pres.addSlide();
    s.background = { color: C.white };

    // Barra lateral izquierda navy
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 0.18, h: SLIDE_H,
      fill: { color: C.navyDark }, line: { color: C.navyDark },
    });

    // Barra horizontal superior navy con cliente
    s.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 0.35,
      fill: { color: C.navyDark }, line: { color: C.navyDark },
    });
    s.addText(p.clientName.toUpperCase(), {
      x: 0.5, y: 0.02, w: 8, h: 0.3,
      fontSize: 10, bold: true, color: C.cyanAccent, fontFace: "Arial",
      charSpacing: 4, valign: "middle",
    });
    s.addText("SEGUIMIENTO SEMANAL QA", {
      x: SLIDE_W - 3.5, y: 0.02, w: 3, h: 0.3,
      fontSize: 9, color: C.textLight, fontFace: "Arial",
      align: "right", valign: "middle", charSpacing: 3,
    });

    // Título proyecto
    s.addText(p.projectName, {
      x: 0.6, y: 0.5, w: 12, h: 0.85,
      fontSize: 34, bold: true, color: C.navyDark, fontFace: "Arial",
    });

    // Divider cyan+green bajo título
    s.addShape(pres.ShapeType.rect, {
      x: 0.65, y: 1.3, w: 0.8, h: 0.05,
      fill: { color: C.cyanAccent }, line: { color: C.cyanAccent },
    });
    s.addShape(pres.ShapeType.rect, {
      x: 1.45, y: 1.3, w: 0.4, h: 0.05,
      fill: { color: C.greenAccent }, line: { color: C.greenAccent },
    });

    // ── Bloque EQUIPO (izquierda) ──
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y: 1.7, w: 4.3, h: 0.5,
      fill: { color: C.blueHeader }, line: { color: C.blueHeader },
    });
    s.addText("EQUIPO", {
      x: 0.6, y: 1.7, w: 4.3, h: 0.5,
      fontSize: 18, bold: true, color: C.white, align: "center",
      valign: "middle", fontFace: "Arial", charSpacing: 4,
    });
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y: 2.2, w: 4.3, h: 1.95,
      fill: { color: C.softGray }, line: { color: C.borderSubtle },
    });
    const equipoText = [
      { text: "Jefe de Proyecto:  ", options: { bold: true, color: C.blueHeader } },
      { text: (p.projectManagerName ?? "—") + "\n", options: { color: C.textDark } },
      { text: "Analista QA:  ", options: { bold: true, color: C.blueHeader } },
      { text: (p.testerName ?? "—") + "\n", options: { color: C.textDark } },
      { text: "Asignación:  ", options: { bold: true, color: C.blueHeader } },
      { text: p.testerAllocation !== null ? `${p.testerAllocation}%` : "—", options: { color: C.textDark } },
    ];
    s.addText(equipoText, {
      x: 0.8, y: 2.35, w: 3.95, h: 1.75,
      fontSize: 14, fontFace: "Arial", valign: "top", paraSpaceAfter: 10,
    });

    // ── Bloque OBSERVACIONES (derecha) ──
    s.addShape(pres.ShapeType.rect, {
      x: 5.1, y: 1.7, w: 7.6, h: 0.5,
      fill: { color: C.blueMid }, line: { color: C.blueMid },
    });
    s.addText("OBSERVACIONES", {
      x: 5.1, y: 1.7, w: 7.6, h: 0.5,
      fontSize: 18, bold: true, color: C.white, align: "center",
      valign: "middle", fontFace: "Arial", charSpacing: 4,
    });
    s.addShape(pres.ShapeType.rect, {
      x: 5.1, y: 2.2, w: 7.6, h: 1.95,
      fill: { color: C.softGray }, line: { color: C.borderSubtle },
    });
    s.addText("[Escribe aquí las observaciones de la semana]", {
      x: 5.3, y: 2.35, w: 7.2, h: 1.75,
      fontSize: 12, color: C.textLight, italic: true, fontFace: "Arial", valign: "top",
    });

    // ── Header MÉTRICAS POR HU ──
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y: 4.35, w: 12.1, h: 0.5,
      fill: { color: C.cyanAccent }, line: { color: C.cyanAccent },
    });
    s.addText(`MÉTRICAS POR HISTORIA DE USUARIO — ${p.projectName.toUpperCase()}`, {
      x: 0.6, y: 4.35, w: 12.1, h: 0.5,
      fontSize: 14, bold: true, color: C.white, align: "center",
      valign: "middle", fontFace: "Arial", charSpacing: 3,
    });

    // ── Tabla de HUs ──
    const headerOpts = {
      bold: true, color: C.white, fill: { color: C.navyDark },
      fontFace: "Arial", fontSize: 10,
      align: "center" as const, valign: "middle" as const,
    };
    const headers = [
      { text: "Historia de Usuario", options: headerOpts },
      { text: "Estado", options: headerOpts },
      { text: "Casos Diseñados", options: headerOpts },
      { text: "Casos Ejecutados", options: headerOpts },
      { text: "Bugs Detectados", options: headerOpts },
    ];

    const cellOpts = (idx: number) => ({
      color: C.textDark, fontFace: "Arial", fontSize: 9,
      valign: "middle" as const,
      fill: { color: idx % 2 === 0 ? C.white : C.lightBlueTint },
    });

    const dataRows = p.hus.length === 0
      ? [[
          { text: "(Sin HU con actividad esta semana)", options: { ...cellOpts(0), italic: true, align: "center" as const, colspan: 5 } },
        ]]
      : p.hus.map((hu, idx) => [
          { text: hu.title, options: { ...cellOpts(idx), align: "left" as const } },
          { text: labelFor(hu.status), options: { ...cellOpts(idx), align: "center" as const } },
          { text: fmtNum(hu.designed), options: { ...cellOpts(idx), align: "center" as const } },
          { text: fmtNum(hu.executed), options: { ...cellOpts(idx), align: "center" as const } },
          { text: fmtNum(hu.defects), options: { ...cellOpts(idx), align: "center" as const } },
        ]);

    s.addTable([headers, ...dataRows] as any, {
      x: 0.6, y: 4.85, w: 12.1,
      colW: [5.7, 2.5, 1.2, 1.3, 1.4],
      rowH: 0.42,
      border: { type: "solid", pt: 0.5, color: C.borderSubtle },
      fontFace: "Arial",
    });

    // Fecha abajo derecha
    s.addText(formatWeekRange(input.weekStart, input.weekEnd), {
      x: 8.5, y: SLIDE_H - 0.45, w: 4.3, h: 0.3,
      fontSize: 10, color: C.textMuted, italic: true, align: "right", fontFace: "Arial",
    });
  }

  // ══════ Slide final — Despedida ══════
  {
    const s = pres.addSlide();
    s.background = { color: C.navyDark };

    // Logo centrado arriba
    if (logoDataUrl) {
      s.addImage({ data: logoDataUrl, x: (SLIDE_W - 3.5) / 2, y: 1.2, w: 3.5, h: 0.68 });
    }

    s.addText("Gracias", {
      x: 0, y: 2.6, w: SLIDE_W, h: 1.5,
      fontSize: 80, bold: true, color: C.white, fontFace: "Arial", align: "center",
    });
    s.addShape(pres.ShapeType.rect, {
      x: SLIDE_W / 2 - 1, y: 4.3, w: 1.2, h: 0.05,
      fill: { color: C.cyanAccent }, line: { color: C.cyanAccent },
    });
    s.addShape(pres.ShapeType.rect, {
      x: SLIDE_W / 2 + 0.2, y: 4.3, w: 0.8, h: 0.05,
      fill: { color: C.greenAccent }, line: { color: C.greenAccent },
    });

    s.addText("contacto@inovabiz.com  |  www.inovabiz.com  |  +562 2269 0490", {
      x: 0, y: 4.7, w: SLIDE_W, h: 0.4,
      fontSize: 14, color: C.textLight, fontFace: "Arial", align: "center",
    });
    s.addText("INNOVATION & BUSINESS", {
      x: 0, y: SLIDE_H - 0.6, w: SLIDE_W, h: 0.3,
      fontSize: 10, color: C.textMuted, fontFace: "Arial", align: "center", charSpacing: 6,
    });
  }

  const base64 = (await pres.write({ outputType: "base64" })) as string;
  return Buffer.from(base64, "base64");
}
