import ExcelJS from "exceljs";

export interface RawDailyRow {
  tester_email: string;
  date: string; // YYYY-MM-DD
  project_name: string;
  story_title: string;
  cycle_name: string;
  designed: number;
  executed: number;
  defects: number;
}

export const DAILY_HEADERS = [
  "tester_email",
  "date",
  "project_name",
  "story_title",
  "cycle_name",
  "designed",
  "executed",
  "defects",
] as const;

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "object") {
    const v = val as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (typeof v.text === "string") return v.text.trim();
    if (v.result !== undefined) return toString(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
  }
  return String(val).trim();
}

export async function parseDailyExcelFile(buffer: Buffer): Promise<RawDailyRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no contiene hojas de trabajo");

  const rows: RawDailyRow[] = [];
  const headerRow = sheet.getRow(1);
  const headerMap = new Map<number, string>();

  headerRow.eachCell((cell, colNumber) => {
    const val = toString(cell.value).toLowerCase().trim();
    if (DAILY_HEADERS.includes(val as (typeof DAILY_HEADERS)[number])) {
      headerMap.set(colNumber, val);
    }
  });

  // cycle_name es opcional; el resto obligatorio
  const required = DAILY_HEADERS.filter((h) => h !== "cycle_name");
  const found = [...headerMap.values()];
  const missing = required.filter((h) => !found.includes(h));
  if (missing.length > 0) {
    throw new Error(`Columnas faltantes en el archivo: ${missing.join(", ")}`);
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    headerMap.forEach((header, colNumber) => {
      obj[header] = row.getCell(colNumber).value;
    });
    if (!toString(obj.tester_email) && !toString(obj.date)) return;
    rows.push({
      tester_email: toString(obj.tester_email),
      date: toString(obj.date),
      project_name: toString(obj.project_name),
      story_title: toString(obj.story_title),
      cycle_name: toString(obj.cycle_name),
      designed: toNumber(obj.designed),
      executed: toNumber(obj.executed),
      defects: toNumber(obj.defects),
    });
  });

  return rows;
}

export function parseDailyCsvFile(text: string): RawDailyRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2)
    throw new Error("El archivo CSV esta vacio o no tiene datos");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = DAILY_HEADERS.filter((h) => h !== "cycle_name");
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`Columnas faltantes en el archivo: ${missing.join(", ")}`);
  }
  const idx = new Map<string, number>();
  DAILY_HEADERS.forEach((h) => idx.set(h, headers.indexOf(h)));

  const rows: RawDailyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // CSV simple: respeta comillas dobles rudimentariamente
    const raw = lines[i];
    const v: string[] = [];
    let cur = "";
    let inQ = false;
    for (let j = 0; j < raw.length; j++) {
      const ch = raw[j];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { v.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    v.push(cur.trim());

    const get = (k: string) => {
      const i2 = idx.get(k);
      return i2 === undefined || i2 < 0 ? "" : v[i2] ?? "";
    };
    const email = get("tester_email");
    const date = get("date");
    if (!email && !date) continue;
    rows.push({
      tester_email: email,
      date,
      project_name: get("project_name"),
      story_title: get("story_title"),
      cycle_name: get("cycle_name"),
      designed: toNumber(get("designed")),
      executed: toNumber(get("executed")),
      defects: toNumber(get("defects")),
    });
  }
  return rows;
}

export async function generateDailyTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Hoja de instrucciones
  const info = wb.addWorksheet("Instrucciones");
  info.columns = [{ header: "Instrucciones", key: "txt", width: 100 }];
  info.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  info.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
  const instructions = [
    "Plantilla de carga de Registros Diarios.",
    "",
    "Columnas obligatorias (respetar encabezados en fila 1 de la hoja 'Registros diarios'):",
    "  - tester_email: correo del usuario vinculado al tester.",
    "  - date: fecha en formato YYYY-MM-DD. Debe ser dia habil (L-V, no feriado), no futura.",
    "  - project_name: nombre exacto del proyecto.",
    "  - story_title: titulo exacto de la HU (User Story) dentro del proyecto.",
    "  - cycle_name: nombre del ciclo (TestCycle) de la HU. Si queda vacio, se usa el ciclo mas reciente de la HU.",
    "  - designed: casos disenados (entero >= 0).",
    "  - executed: casos ejecutados (entero >= 0).",
    "  - defects: defectos reportados (entero >= 0).",
    "",
    "Notas:",
    "  - Si no existe una asignacion (tester+HU+ciclo), se creara automaticamente con estado REGISTERED.",
    "  - El registro se hace upsert por (asignacion, fecha).",
    "  - No se permiten fechas futuras ni feriados.",
  ];
  for (const line of instructions) info.addRow({ txt: line });

  const ws = wb.addWorksheet("Registros diarios");
  ws.columns = [
    { header: "tester_email", key: "tester_email", width: 28 },
    { header: "date", key: "date", width: 14 },
    { header: "project_name", key: "project_name", width: 30 },
    { header: "story_title", key: "story_title", width: 40 },
    { header: "cycle_name", key: "cycle_name", width: 20 },
    { header: "designed", key: "designed", width: 12 },
    { header: "executed", key: "executed", width: 12 },
    { header: "defects", key: "defects", width: 12 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F3864" },
  };
  ws.addRow({
    tester_email: "tester@example.com",
    date: "2026-04-13",
    project_name: "Core Bancario v3.0",
    story_title: "HU-1: Funcionalidad 1 del Core Bancario",
    cycle_name: "Sprint 1-4",
    designed: 5,
    executed: 3,
    defects: 1,
  });
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
