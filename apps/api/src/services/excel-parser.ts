import ExcelJS from "exceljs";

export interface RawRow {
  tester_name: string;
  cycle: string;
  week_start: string;
  designed_functional: number;
  designed_regression: number;
  designed_smoke: number;
  designed_exploratory: number;
  executed_functional: number;
  executed_regression: number;
  executed_smoke: number;
  executed_exploratory: number;
  defects_critical: number;
  defects_high: number;
  defects_medium: number;
  defects_low: number;
}

const EXPECTED_HEADERS = [
  "tester_name",
  "cycle",
  "week_start",
  "designed_functional",
  "designed_regression",
  "designed_smoke",
  "designed_exploratory",
  "executed_functional",
  "executed_regression",
  "executed_smoke",
  "executed_exploratory",
  "defects_critical",
  "defects_high",
  "defects_medium",
  "defects_low",
] as const;

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return String(val).trim();
}

export async function parseExcelFile(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no contiene hojas de trabajo");

  const rows: RawRow[] = [];
  const headerRow = sheet.getRow(1);
  const headerMap = new Map<number, string>();

  headerRow.eachCell((cell, colNumber) => {
    const val = toString(cell.value).toLowerCase().trim();
    if (EXPECTED_HEADERS.includes(val as (typeof EXPECTED_HEADERS)[number])) {
      headerMap.set(colNumber, val);
    }
  });

  if (headerMap.size < EXPECTED_HEADERS.length) {
    const found = [...headerMap.values()];
    const missing = EXPECTED_HEADERS.filter((h) => !found.includes(h));
    throw new Error(`Columnas faltantes en el archivo: ${missing.join(", ")}`);
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj: Record<string, unknown> = {};
    headerMap.forEach((header, colNumber) => {
      obj[header] = row.getCell(colNumber).value;
    });

    if (!toString(obj.tester_name) && !toString(obj.cycle)) return;

    rows.push({
      tester_name: toString(obj.tester_name),
      cycle: toString(obj.cycle),
      week_start: toString(obj.week_start),
      designed_functional: toNumber(obj.designed_functional),
      designed_regression: toNumber(obj.designed_regression),
      designed_smoke: toNumber(obj.designed_smoke),
      designed_exploratory: toNumber(obj.designed_exploratory),
      executed_functional: toNumber(obj.executed_functional),
      executed_regression: toNumber(obj.executed_regression),
      executed_smoke: toNumber(obj.executed_smoke),
      executed_exploratory: toNumber(obj.executed_exploratory),
      defects_critical: toNumber(obj.defects_critical),
      defects_high: toNumber(obj.defects_high),
      defects_medium: toNumber(obj.defects_medium),
      defects_low: toNumber(obj.defects_low),
    });
  });

  return rows;
}

export function parseCsvFile(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2)
    throw new Error("El archivo CSV esta vacio o no tiene datos");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`Columnas faltantes en el archivo: ${missing.join(", ")}`);
  }

  const headerIndices = new Map<string, number>();
  EXPECTED_HEADERS.forEach((h) => {
    headerIndices.set(h, headers.indexOf(h));
  });

  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const get = (key: string) => values[headerIndices.get(key)!] ?? "";

    const testerName = get("tester_name");
    const cycle = get("cycle");
    if (!testerName && !cycle) continue;

    rows.push({
      tester_name: testerName,
      cycle: cycle,
      week_start: get("week_start"),
      designed_functional: toNumber(get("designed_functional")),
      designed_regression: toNumber(get("designed_regression")),
      designed_smoke: toNumber(get("designed_smoke")),
      designed_exploratory: toNumber(get("designed_exploratory")),
      executed_functional: toNumber(get("executed_functional")),
      executed_regression: toNumber(get("executed_regression")),
      executed_smoke: toNumber(get("executed_smoke")),
      executed_exploratory: toNumber(get("executed_exploratory")),
      defects_critical: toNumber(get("defects_critical")),
      defects_high: toNumber(get("defects_high")),
      defects_medium: toNumber(get("defects_medium")),
      defects_low: toNumber(get("defects_low")),
    });
  }

  return rows;
}
