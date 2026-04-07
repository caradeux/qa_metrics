import ExcelJS from "exceljs";
import type {
  KPIs,
  WeeklyTrendPoint,
  TesterSummary,
  DefectDistribution,
} from "@qa-metrics/utils";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  size: 11,
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row.height = 25;
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length + 2 : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max, 35);
  });
}

interface ReportData {
  projectName: string;
  clientName: string;
  kpis: KPIs;
  weeklyTrend: WeeklyTrendPoint[];
  testerSummary: TesterSummary[];
  cycleComparison: Array<{
    cycleName: string;
    totalDesigned: number;
    totalExecuted: number;
    totalDefects: number;
    executionRatio: number;
  }>;
  defectsBySeverity: DefectDistribution;
}

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Hoja 1: Resumen General
  const sheet1 = workbook.addWorksheet("Resumen General");
  sheet1.addRow(["Sistema de Metricas QA"]).font = { bold: true, size: 14 };
  sheet1.addRow([]);
  sheet1.addRow(["Proyecto:", data.projectName]);
  sheet1.addRow(["Cliente:", data.clientName]);
  sheet1.addRow([]);
  sheet1.addRow(["KPI", "Valor"]);
  styleHeader(sheet1.getRow(6));
  sheet1.addRow(["Total Casos Disenados", data.kpis.totalDesigned]);
  sheet1.addRow(["Total Casos Ejecutados", data.kpis.totalExecuted]);
  sheet1.addRow(["Total Defectos", data.kpis.totalDefects]);
  sheet1.addRow([
    "Ratio Ejecucion/Diseno",
    `${data.kpis.executionRatio}%`,
  ]);
  autoWidth(sheet1);

  // Hoja 2: Detalle por Semana
  const sheet2 = workbook.addWorksheet("Detalle por Semana");
  sheet2.addRow(["Semana", "Disenados", "Ejecutados", "Defectos"]);
  styleHeader(sheet2.getRow(1));
  data.weeklyTrend.forEach((w, i) => {
    const row = sheet2.addRow([w.weekStart, w.designed, w.executed, w.defects]);
    if (i % 2 === 1)
      row.eachCell((c) => {
        c.fill = ALT_ROW_FILL;
      });
  });
  const totals = data.weeklyTrend.reduce(
    (a, w) => ({
      d: a.d + w.designed,
      e: a.e + w.executed,
      def: a.def + w.defects,
    }),
    { d: 0, e: 0, def: 0 }
  );
  const totalRow = sheet2.addRow(["TOTAL", totals.d, totals.e, totals.def]);
  totalRow.font = { bold: true };
  autoWidth(sheet2);

  // Hoja 3: Detalle por Tester
  const sheet3 = workbook.addWorksheet("Detalle por Tester");
  sheet3.addRow(["Tester", "Disenados", "Ejecutados", "Defectos", "Ratio"]);
  styleHeader(sheet3.getRow(1));
  data.testerSummary.forEach((t, i) => {
    const row = sheet3.addRow([
      t.testerName,
      t.designed,
      t.executed,
      t.defects,
      `${t.ratio}%`,
    ]);
    if (i % 2 === 1)
      row.eachCell((c) => {
        c.fill = ALT_ROW_FILL;
      });
  });
  autoWidth(sheet3);

  // Hoja 4: Detalle por Ciclo
  const sheet4 = workbook.addWorksheet("Detalle por Ciclo");
  sheet4.addRow(["Ciclo", "Disenados", "Ejecutados", "Defectos", "Ratio"]);
  styleHeader(sheet4.getRow(1));
  data.cycleComparison.forEach((c, i) => {
    const row = sheet4.addRow([
      c.cycleName,
      c.totalDesigned,
      c.totalExecuted,
      c.totalDefects,
      `${c.executionRatio}%`,
    ]);
    if (i % 2 === 1)
      row.eachCell((cell) => {
        cell.fill = ALT_ROW_FILL;
      });
  });
  autoWidth(sheet4);

  // Hoja 5: Defectos por Severidad
  const sheet5 = workbook.addWorksheet("Defectos por Severidad");
  sheet5.addRow(["Severidad", "Cantidad"]);
  styleHeader(sheet5.getRow(1));
  sheet5.addRow(["Critico", data.defectsBySeverity.critical]);
  sheet5.addRow(["Alto", data.defectsBySeverity.high]);
  sheet5.addRow(["Medio", data.defectsBySeverity.medium]);
  sheet5.addRow(["Bajo", data.defectsBySeverity.low]);
  const totalDef =
    data.defectsBySeverity.critical +
    data.defectsBySeverity.high +
    data.defectsBySeverity.medium +
    data.defectsBySeverity.low;
  const defTotalRow = sheet5.addRow(["TOTAL", totalDef]);
  defTotalRow.font = { bold: true };
  autoWidth(sheet5);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
