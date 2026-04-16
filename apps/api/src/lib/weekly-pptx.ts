import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

// Resolución de ruta absoluta al template
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "..", "..", "assets", "weekly-template.pptx");

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

// XML escaping para valores que irán dentro de <a:t>
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

/**
 * Encuentra el shape por name y reemplaza el texto dentro de su primer <a:t>.
 * Mantiene el formato del run (fontFace, size, color) intacto.
 *
 * Si hay varios <a:t> dentro del shape, sólo reemplaza el primero y elimina
 * los siguientes en el MISMO párrafo (para evitar texto concatenado). Esto
 * cubre el caso común de texto con formatos mixtos en una sola línea.
 */
function replaceTextInShape(xml: string, shapeName: string, newText: string): string {
  const shapeRegex = new RegExp(
    `(<p:sp>\\s*<p:nvSpPr>\\s*<p:cNvPr id="\\d+" name="${shapeName}"[\\s\\S]*?</p:sp>)`,
  );
  const m = xml.match(shapeRegex);
  if (!m) return xml;
  const shape = m[1]!;

  // Reemplazar el primer <a:t>…</a:t> del primer <a:r>
  const runRegex = /(<a:r>[\s\S]*?<a:t>)([^<]*)(<\/a:t>)([\s\S]*?<\/a:r>)/;
  const newShape = shape.replace(runRegex, `$1${xmlEscape(newText)}$3$4`);
  return xml.replace(shape, newShape);
}

/**
 * Para un shape con texto mixto (múltiples runs en uno o varios párrafos),
 * reemplaza TODO el contenido por las líneas dadas. Conserva solo el primer
 * `<a:r>` como plantilla de formato y elimina el resto dentro de cada párrafo.
 * Se produce un párrafo por línea.
 */
function replaceMultilineInShape(xml: string, shapeName: string, lines: string[]): string {
  const shapeRegex = new RegExp(
    `(<p:sp><p:nvSpPr><p:cNvPr id="\\d+" name="${shapeName}"[^>]*/>[\\s\\S]*?</p:sp>)`,
  );
  const m = xml.match(shapeRegex);
  if (!m) return xml;
  const shape = m[1]!;

  // Tomar el primer párrafo como plantilla
  const firstP = (shape.match(/<a:p>[\s\S]*?<\/a:p>/) ?? [""])[0];
  if (!firstP) return xml;

  // Dentro del primer párrafo, quedarse solo con el primer <a:r>
  const firstRunMatch = firstP.match(/<a:r>[\s\S]*?<\/a:r>/);
  if (!firstRunMatch) return xml;
  const firstRun = firstRunMatch[0];

  // Eliminar todos los <a:r> del párrafo, dejando el hueco para insertar
  // un solo run (el primero, con el texto nuevo)
  const pWithoutRuns = firstP.replace(/(<a:r>[\s\S]*?<\/a:r>)+/g, "___RUN_SLOT___");

  const newParagraphs = lines.map((line) => {
    const newRun = firstRun.replace(
      /(<a:t>)([^<]*)(<\/a:t>)/,
      `$1${xmlEscape(line)}$3`,
    );
    return pWithoutRuns.replace("___RUN_SLOT___", newRun);
  }).join("");

  // Reemplazar TODOS los párrafos (uno o más) por los nuevos
  const allParasRegex = /(<a:p>[\s\S]*?<\/a:p>)+/;
  const newShape = shape.replace(allParasRegex, newParagraphs);
  return xml.replace(shape, newShape);
}

/**
 * Reemplaza el contenido de la tabla "Tabla QA Metricas …" manteniendo el
 * header y generando una fila por HU a partir del primer data-row como molde.
 */
function replaceTableRows(xml: string, hus: WeeklyHU[]): string {
  // Tomar el bloque <a:tbl>…</a:tbl>
  const tblRegex = /(<a:tbl>[\s\S]*?<\/a:tbl>)/;
  const mTbl = xml.match(tblRegex);
  if (!mTbl) return xml;
  const tbl = mTbl[1]!;

  const rows = Array.from(tbl.matchAll(/<a:tr [^>]*>[\s\S]*?<\/a:tr>/g)).map((m) => m[0]);
  if (rows.length < 2) return xml; // esperamos header + >=1 data

  const headerRow = rows[0]!;
  const dataRowTemplate = rows[1]!;

  // Cada celda tiene <a:tc>…</a:tc>. Reemplazamos el texto de cada tc.
  function buildRow(cells: string[]): string {
    const tcMatches = Array.from(dataRowTemplate.matchAll(/<a:tc[\s\S]*?<\/a:tc>/g)).map((m) => m[0]);
    if (tcMatches.length !== cells.length) {
      // La plantilla puede traer menos/más columnas; ajustamos por la intersección.
    }
    const newTcs = tcMatches.map((tc, i) => {
      const val = cells[i] ?? "-";
      // Reemplazar SOLO el primer <a:t>…</a:t> de la tc (preservando formato)
      return tc.replace(
        /(<a:r>[\s\S]*?<a:t>)([^<]*)(<\/a:t>)([\s\S]*?<\/a:r>)/,
        `$1${xmlEscape(val)}$3$4`,
      );
    });
    // Reconstruir fila reemplazando tcs en la plantilla
    let newRow = dataRowTemplate;
    tcMatches.forEach((tc, i) => {
      newRow = newRow.replace(tc, newTcs[i]!);
    });
    return newRow;
  }

  const newDataRows = hus.length === 0
    ? [buildRow(["(Sin HU con actividad esta semana)", "-", "-", "-", "-", "-", "-"])]
    : hus.map((hu) =>
        buildRow([
          hu.title,
          labelFor(hu.status),
          "-",              // Consultas Levantadas
          "-",              // CA Validados
          fmtNum(hu.designed),
          fmtNum(hu.executed),
          fmtNum(hu.defects),
        ]),
      );

  const newRowsBlock = headerRow + newDataRows.join("");
  // Reemplazar todas las filas dentro de la tabla
  const allRowsRegex = /(<a:tr [^>]*>[\s\S]*?<\/a:tr>)+/;
  const newTbl = tbl.replace(allRowsRegex, newRowsBlock);

  return xml.replace(tbl, newTbl);
}

/**
 * Rellena un slide de proyecto (plantilla = slide2 original) con los datos
 * de un proyecto concreto.
 */
function customizeProjectSlide(
  templateXml: string,
  p: WeeklyProjectSlide,
  weekStart: Date,
  weekEnd: Date,
): string {
  let xml = templateXml;

  // 1) Título del proyecto (Text 1)
  xml = replaceTextInShape(xml, "Text 1", p.projectName);

  // 2) Team — Text 5 tiene 3 líneas
  const teamLines = [
    `Jefe de Proyecto: ${p.projectManagerName ?? "—"}`,
    `Analista QA: ${p.testerName ?? "—"}`,
    `Asignación: ${p.testerAllocation !== null ? `${p.testerAllocation}%` : "—"}`,
  ];
  xml = replaceMultilineInShape(xml, "Text 5", teamLines);

  // 3) Observaciones (Text 17) — texto placeholder
  xml = replaceMultilineInShape(xml, "Text 17", ["[Escribe aquí las observaciones de la semana]"]);

  // 4) Header MÉTRICAS (LabelBar 210) — "MÉTRICAS POR HISTORIA DE USUARIO — {NAME}"
  xml = replaceTextInShape(
    xml,
    "LabelBar 210",
    `MÉTRICAS POR HISTORIA DE USUARIO — ${p.projectName.toUpperCase()}`,
  );

  // 5) Fecha (Text 26 en v2, o Text 18 en v1)
  const dateStr = formatWeekRange(weekStart, weekEnd);
  xml = replaceTextInShape(xml, "Text 26", dateStr);
  xml = replaceTextInShape(xml, "Text 18", dateStr); // retrocompat

  // 6) Tabla de HUs
  xml = replaceTableRows(xml, p.hus);

  return xml;
}

/**
 * Ajusta el slide de portada (slide1): año y rango de semana.
 * Si no hay campos reconocibles, devuelve el XML intacto (el usuario puede
 * actualizarlo manualmente en PowerPoint).
 */
function customizeCover(templateXml: string, weekStart: Date, weekEnd: Date): string {
  let xml = templateXml;
  // Intento: reemplazar el año "2026" por el actual en los Text del slide1
  const year = format(weekEnd, "yyyy");
  xml = xml.replace(/(<a:t>)(\d{4})(<\/a:t>)/g, (_m, a, _y, c) => `${a}${year}${c}`);
  return xml;
}

/**
 * Rebuilder de presentation.xml con los sldIds apuntando a los nuevos slides.
 * Formato: sldId id="256+i" r:id="rId{5+i}"
 */
function buildPresentationXml(basePresentationXml: string, slideCount: number): string {
  const sldIds = Array.from({ length: slideCount }, (_v, i) => {
    return `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`;
  }).join("");
  return basePresentationXml.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    `<p:sldIdLst>${sldIds}</p:sldIdLst>`,
  );
}

/**
 * Relaciones de presentation.xml: remueve las de slides viejas y añade las
 * nuevas. Conserva cualquier otra relación (theme, notesMaster, etc.).
 */
function buildPresentationRels(baseRelsXml: string, slideCount: number): string {
  // Quitar las relaciones de slides existentes
  let xml = baseRelsXml.replace(/<Relationship Id="[^"]+"\s+Type="[^"]+slide"[^/]*\/>/g, "");
  // Insertar relaciones nuevas antes de </Relationships>
  const newRels = Array.from({ length: slideCount }, (_v, i) => {
    return `<Relationship Id="rId${100 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  }).join("");
  return xml.replace("</Relationships>", newRels + "</Relationships>");
}

/**
 * [Content_Types].xml: remueve Overrides de slides/notesSlides y agrega los
 * nuevos slides. Los notesSlides se eliminan del content types (no los vamos
 * a generar; slides sin notesSlide funcionan).
 */
function buildContentTypes(baseXml: string, slideCount: number): string {
  let xml = baseXml
    // Quitar overrides de slides y notesSlides existentes
    .replace(/<Override[^/]+PartName="\/ppt\/slides\/slide\d+\.xml"[^/]*\/>/g, "")
    .replace(/<Override[^/]+PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^/]*\/>/g, "");
  const newOverrides = Array.from({ length: slideCount }, (_v, i) => {
    return `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }).join("");
  return xml.replace("</Types>", newOverrides + "</Types>");
}

/**
 * Rels de un slide: remueve la referencia al notesSlide (no lo generaremos).
 */
function cleanSlideRels(relsXml: string): string {
  return relsXml.replace(/<Relationship [^/]+notesSlide[^/]*\/>/g, "");
}

export async function buildWeeklyPptxBuffer(input: WeeklyPptxInput): Promise<Buffer> {
  const templateBuf = readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  // 1) Leer templates
  const coverFile = zip.file("ppt/slides/slide1.xml");
  const projectFile = zip.file("ppt/slides/slide2.xml");
  const closingFile = zip.file("ppt/slides/slide9.xml");
  if (!coverFile || !projectFile || !closingFile) {
    throw new Error("Plantilla PPTX inválida: faltan slides base (1, 2 o 9)");
  }
  const coverXml = await coverFile.async("string");
  const projectXml = await projectFile.async("string");
  const closingXml = await closingFile.async("string");

  const coverRelsFile = zip.file("ppt/slides/_rels/slide1.xml.rels");
  const projectRelsFile = zip.file("ppt/slides/_rels/slide2.xml.rels");
  const closingRelsFile = zip.file("ppt/slides/_rels/slide9.xml.rels");
  const coverRels = coverRelsFile ? cleanSlideRels(await coverRelsFile.async("string")) : undefined;
  const projectRels = projectRelsFile ? cleanSlideRels(await projectRelsFile.async("string")) : undefined;
  const closingRels = closingRelsFile ? cleanSlideRels(await closingRelsFile.async("string")) : undefined;

  const presentationXml = await zip.file("ppt/presentation.xml")!.async("string");
  const presentationRels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  const contentTypes = await zip.file("[Content_Types].xml")!.async("string");

  // 2) Remover TODOS los slides y sus rels (limpieza total)
  const allFileNames = Object.keys(zip.files);
  for (const fn of allFileNames) {
    if (fn.startsWith("ppt/slides/slide") || fn.startsWith("ppt/slides/_rels/slide")) {
      zip.remove(fn);
    }
    if (fn.startsWith("ppt/notesSlides/")) {
      zip.remove(fn);
    }
  }

  // 3) Generar nuevos slides
  const generated: Array<{ name: string; content: string; rels?: string }> = [];

  generated.push({
    name: "slide1.xml",
    content: customizeCover(coverXml, input.weekStart, input.weekEnd),
    rels: coverRels,
  });

  input.projects.forEach((p, i) => {
    generated.push({
      name: `slide${i + 2}.xml`,
      content: customizeProjectSlide(projectXml, p, input.weekStart, input.weekEnd),
      rels: projectRels,
    });
  });

  generated.push({
    name: `slide${input.projects.length + 2}.xml`,
    content: closingXml,
    rels: closingRels,
  });

  // 4) Escribir archivos
  for (const s of generated) {
    zip.file(`ppt/slides/${s.name}`, s.content);
    if (s.rels) {
      zip.file(`ppt/slides/_rels/${s.name}.rels`, s.rels);
    }
  }

  // 5) Reconstruir presentation.xml, rels y content types
  zip.file("ppt/presentation.xml", buildPresentationXml(presentationXml, generated.length));
  zip.file("ppt/_rels/presentation.xml.rels", buildPresentationRels(presentationRels, generated.length));
  zip.file("[Content_Types].xml", buildContentTypes(contentTypes, generated.length));

  // 6) Generar buffer
  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
