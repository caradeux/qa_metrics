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
  charts?: {
    pipeline: Buffer;
    designedVsExecuted: Buffer;
    defects: Buffer;
    monthlyCumulative?: Buffer;
  };
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

// Ancho máximo de las barras horizontales en los dashboard slides (EMU)
const BAR_FULL_CX = 4937760;

function scaleBarWidth(xml: string, barName: string, value: number, maxValue: number): string {
  if (maxValue <= 0) return xml;
  const newCx = Math.max(Math.round((value / maxValue) * BAR_FULL_CX), value > 0 ? 60000 : 0);
  const regex = new RegExp(`(name="${barName}"[\\s\\S]*?<a:ext cx=")\\d+`);
  return xml.replace(regex, `$1${newCx}`);
}

interface ProjectMetric { name: string; designed: number; executed: number; defects: number }

function computeProjectMetrics(projects: WeeklyProjectSlide[]): ProjectMetric[] {
  return projects.map((p) => {
    let d = 0, e = 0, bug = 0;
    for (const hu of p.hus) {
      d += hu.designed ?? 0;
      e += hu.executed ?? 0;
      bug += hu.defects ?? 0;
    }
    return { name: p.projectName, designed: d, executed: e, defects: bug };
  });
}

function populateBarsSlide(
  xml: string,
  metrics: ProjectMetric[],
  field: "designed" | "executed",
  weekLabel: string,
): string {
  const values = metrics.map((m) => m[field]);
  const total = values.reduce((s, v) => s + v, 0);
  const maxVal = Math.max(...values, 1);
  const withActivity = values.filter((v) => v > 0).length;
  const avg = metrics.length > 0 ? (total / metrics.length).toFixed(1) : "0";

  let x = xml;
  x = replaceTextInShape(x, "Subtitle", `Distribución de casos ${field === "designed" ? "diseñados" : "ejecutados"} — ${metrics.length} iniciativas activas`);
  x = replaceTextInShape(x, "KPI0big", String(total));
  x = replaceTextInShape(x, "KPI0lbl", field === "designed" ? "Total Diseñados" : "Total Ejecutados");
  x = replaceTextInShape(x, "KPI0sub", weekLabel);
  x = replaceTextInShape(x, "KPI1big", String(withActivity));
  x = replaceTextInShape(x, "KPI1lbl", "Iniciativas");
  x = replaceTextInShape(x, "KPI1sub", field === "designed" ? "con diseño" : "con ejecución");
  x = replaceTextInShape(x, "KPI2big", avg);
  x = replaceTextInShape(x, "KPI2lbl", "Promedio");
  x = replaceTextInShape(x, "KPI2sub", "por iniciativa");

  for (let i = 0; i < 7; i++) {
    const m = metrics[i];
    x = replaceTextInShape(x, `Lbl${i}`, m?.name ?? "");
    x = replaceTextInShape(x, `Val${i}`, m ? String(m[field]) : "");
    x = scaleBarWidth(x, `Bar${i}`, m ? m[field] : 0, maxVal);
  }
  return x;
}

function populateDistributionSlide(xml: string, metrics: ProjectMetric[], field: "designed" | "executed"): string {
  const total = metrics.reduce((s, m) => s + m[field], 0);
  let x = xml;
  x = replaceTextInShape(x, "TotalNum", String(total));
  const sorted = [...metrics].sort((a, b) => b[field] - a[field]);
  for (let i = 0; i < 7; i++) {
    const m = sorted[i];
    const pct = m && total > 0 ? Math.round((m[field] / total) * 100) : 0;
    x = replaceTextInShape(x, `N${i}`, m?.name ?? "");
    x = replaceTextInShape(x, `C${i}`, m ? String(m[field]) : "0");
    x = replaceTextInShape(x, `P${i}`, m ? `${pct}%` : "0%");
    x = scaleBarWidth(x, `BV${i}`, m ? m[field] : 0, Math.max(...metrics.map((m) => m[field]), 1));
  }
  return x;
}

function populateAvgSlide(xml: string, metrics: ProjectMetric[], field: "designed" | "executed"): string {
  const values = metrics.map((m) => m[field]);
  const total = values.reduce((s, v) => s + v, 0);
  const maxVal = Math.max(...values, 0);
  const maxProject = metrics.find((m) => m[field] === maxVal);
  const withActivity = values.filter((v) => v > 0).length;
  const without = metrics.length - withActivity;
  const avg = metrics.length > 0 ? (total / metrics.length).toFixed(1) : "0";

  let x = xml;
  x = replaceTextInShape(x, "HeroNum", avg);
  x = replaceTextInShape(x, "HeroSub", `Base: ${total} casos / ${metrics.length} iniciativas`);
  x = replaceTextInShape(x, "Snum0", String(total));
  x = replaceTextInShape(x, "Slbl0", field === "designed" ? "Total casos diseñados" : "Total casos ejecutados");
  x = replaceTextInShape(x, "Snum1", String(maxVal));
  x = replaceTextInShape(x, "Slbl1", `Máximo (${maxProject?.name ?? "-"})`);
  x = replaceTextInShape(x, "Snum2", String(withActivity));
  x = replaceTextInShape(x, "Slbl2", field === "designed" ? "Iniciativas con diseño" : "Iniciativas con ejecución");
  x = replaceTextInShape(x, "Snum3", String(without));
  x = replaceTextInShape(x, "Slbl3", field === "designed" ? "Iniciativas sin diseño" : "Iniciativas sin ejecución");
  return x;
}

function populateExecByInitiativeSlide(xml: string, metrics: ProjectMetric[]): string {
  let x = xml;
  for (let i = 0; i < 7; i++) {
    const m = metrics[i];
    x = replaceTextInShape(x, `N${i}`, m?.name ?? "");
    x = replaceTextInShape(x, `D${i}`, m ? String(m.designed) : "0");
    x = replaceTextInShape(x, `E${i}`, m ? String(m.executed) : "0");
  }
  return x;
}

function populateHUSlide(xml: string, projects: WeeklyProjectSlide[]): string {
  const allHUs = projects.flatMap((p) =>
    p.hus.map((hu) => ({ ...hu, project: p.projectName })),
  );
  const total = allHUs.length;
  const byStatus = new Map<string, number>();
  for (const hu of allHUs) {
    const lbl = labelFor(hu.status);
    byStatus.set(lbl, (byStatus.get(lbl) ?? 0) + 1);
  }

  let x = xml;
  x = replaceTextInShape(x, "Kbig0", String(total));
  x = replaceTextInShape(x, "Kbig1", String(byStatus.get("En Diseño") ?? 0));
  x = replaceTextInShape(x, "Kbig2", String(byStatus.get("Pdte. Aprobación") ?? 0));
  x = replaceTextInShape(x, "Kbig3", String((byStatus.get("En Curso") ?? 0) + (byStatus.get("Pdte. Instalación QA") ?? 0)));
  x = replaceTextInShape(x, "Kbig4", String(byStatus.get("Devuelto a Desarrollo") ?? 0));
  return x;
}

function buildChartSlideXml(title: string): string {
  const SLIDE_H = 6858000;
  const SLIDE_W = 12192000;
  const IMG = { x: 457200, y: 1143000, cx: 11277600, cy: 5486400 };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld name="${xmlEscape(title)}">
  <p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
  <p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="GreenBar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="73152" cy="${SLIDE_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="22C55E"/></a:solidFill><a:ln/></p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="es-CL"/></a:p></p:txBody>
    </p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="457200" y="320040"/><a:ext cx="${SLIDE_W - 914400}" cy="548640"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln/></p:spPr>
      <p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/><a:lstStyle/>
        <a:p><a:pPr marL="0" indent="0"><a:buNone/></a:pPr>
          <a:r><a:rPr lang="es-CL" sz="3400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${xmlEscape(title)}</a:t></a:r>
        </a:p>
      </p:txBody>
    </p:sp>
    <p:pic><p:nvPicPr><p:cNvPr id="10" name="Chart"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rIdChart1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
      <p:spPr><a:xfrm><a:off x="${IMG.x}" y="${IMG.y}"/><a:ext cx="${IMG.cx}" cy="${IMG.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    </p:pic>
  </p:spTree>
</p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function buildChartSlideRels(chartFileName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdChart1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${chartFileName}"/>
</Relationships>`;
}

async function readSlide(zip: JSZip, num: number) {
  const f = zip.file(`ppt/slides/slide${num}.xml`);
  const r = zip.file(`ppt/slides/_rels/slide${num}.xml.rels`);
  return {
    xml: f ? await f.async("string") : "",
    rels: r ? cleanSlideRels(await r.async("string")) : undefined,
  };
}

export async function buildWeeklyPptxBuffer(input: WeeklyPptxInput): Promise<Buffer> {
  const templateBuf = readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  // 1) Leer todas las slides del template
  const cover = await readSlide(zip, 1);
  const project = await readSlide(zip, 2);
  const dashDesigned = await readSlide(zip, 9);
  const dashDesignedDist = await readSlide(zip, 10);
  const dashAvgDesigned = await readSlide(zip, 11);
  const dashExecuted = await readSlide(zip, 12);
  const dashExecDist = await readSlide(zip, 13);
  const dashAvgExecuted = await readSlide(zip, 14);
  const dashAnalysts = await readSlide(zip, 15);
  const dashHUs = await readSlide(zip, 16);
  const closing = await readSlide(zip, 17);

  const presentationXml = await zip.file("ppt/presentation.xml")!.async("string");
  const presentationRels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  const contentTypes = await zip.file("[Content_Types].xml")!.async("string");

  // 2) Remover TODOS los slides, rels y notesSlides
  for (const fn of Object.keys(zip.files)) {
    if (fn.startsWith("ppt/slides/slide") || fn.startsWith("ppt/slides/_rels/slide") || fn.startsWith("ppt/notesSlides/")) {
      zip.remove(fn);
    }
  }

  // 3) Generar nuevos slides
  const generated: Array<{ name: string; content: string; rels?: string }> = [];
  const add = (content: string, rels?: string) => {
    generated.push({ name: `slide${generated.length + 1}.xml`, content, rels });
  };

  // Portada
  add(customizeCover(cover.xml, input.weekStart, input.weekEnd), cover.rels);

  // Slides de proyecto
  for (const p of input.projects) {
    add(customizeProjectSlide(project.xml, p, input.weekStart, input.weekEnd), project.rels);
  }

  // Dashboard slides con datos dinámicos
  const metrics = computeProjectMetrics(input.projects);
  const weekLabel = `Semana ${format(input.weekStart, "dd-MM", { locale: es })}`;

  if (dashDesigned.xml) add(populateBarsSlide(dashDesigned.xml, metrics, "designed", weekLabel), dashDesigned.rels);
  if (dashDesignedDist.xml) add(populateDistributionSlide(dashDesignedDist.xml, metrics, "designed"), dashDesignedDist.rels);
  if (dashAvgDesigned.xml) add(populateAvgSlide(dashAvgDesigned.xml, metrics, "designed"), dashAvgDesigned.rels);
  if (dashExecuted.xml) add(populateBarsSlide(dashExecuted.xml, metrics, "executed", weekLabel), dashExecuted.rels);
  if (dashExecDist.xml) add(populateExecByInitiativeSlide(dashExecDist.xml, metrics), dashExecDist.rels);
  if (dashAvgExecuted.xml) add(populateAvgSlide(dashAvgExecuted.xml, metrics, "executed"), dashAvgExecuted.rels);
  if (dashAnalysts.xml) add(dashAnalysts.xml, dashAnalysts.rels);
  if (dashHUs.xml) add(populateHUSlide(dashHUs.xml, input.projects), dashHUs.rels);

  // Chart de acumulado mensual (imagen) si viene
  if (input.charts?.monthlyCumulative) {
    const file = "chartMonthlyCumulative.png";
    zip.file(`ppt/media/${file}`, input.charts.monthlyCumulative);
    add(buildChartSlideXml("Acumulado Mensual"), buildChartSlideRels(file));
  }

  // Cierre
  add(closing.xml, closing.rels);

  // 4) Escribir archivos
  for (const s of generated) {
    zip.file(`ppt/slides/${s.name}`, s.content);
    if (s.rels) zip.file(`ppt/slides/_rels/${s.name}.rels`, s.rels);
  }

  // 5) Reconstruir presentation.xml, rels y content types
  zip.file("ppt/presentation.xml", buildPresentationXml(presentationXml, generated.length));
  zip.file("ppt/_rels/presentation.xml.rels", buildPresentationRels(presentationRels, generated.length));
  zip.file("[Content_Types].xml", buildContentTypes(contentTypes, generated.length));

  return zip.generateAsync({ type: "nodebuffer" });
}
