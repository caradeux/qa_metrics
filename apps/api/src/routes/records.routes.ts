import { Router, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "@qa-metrics/database";
import { getMonday, isMonday } from "@qa-metrics/utils";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import { batchRecordSchema } from "../validators/record.validator.js";
import {
  parseExcelFile,
  parseCsvFile,
  type RawRow,
} from "../services/excel-parser.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET / — List records with filters
router.get(
  "/",
  requirePermission("records", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { testerId, cycleId, weekStart, projectId } = req.query;

      const where: Record<string, unknown> = {};
      if (testerId) where.testerId = testerId;
      if (cycleId) where.cycleId = cycleId;
      if (weekStart) where.weekStart = new Date(weekStart as string);
      if (projectId) where.tester = { projectId };

      const records = await prisma.weeklyRecord.findMany({
        where,
        include: {
          tester: { select: { name: true } },
          cycle: { select: { name: true } },
        },
        orderBy: { weekStart: "desc" },
      });

      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener registros" });
    }
  }
);

// POST / — Batch create/update records (upsert)
router.post(
  "/",
  requirePermission("records", "create") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = batchRecordSchema.parse(req.body);
      const results = [];

      for (const record of parsed.records) {
        const monday = getMonday(new Date(record.weekStart));

        const designedTotal =
          record.designedFunctional +
          record.designedRegression +
          record.designedSmoke +
          record.designedExploratory;
        const executedTotal =
          record.executedFunctional +
          record.executedRegression +
          record.executedSmoke +
          record.executedExploratory;

        const data = {
          designedTotal,
          designedFunctional: record.designedFunctional,
          designedRegression: record.designedRegression,
          designedSmoke: record.designedSmoke,
          designedExploratory: record.designedExploratory,
          executedTotal,
          executedFunctional: record.executedFunctional,
          executedRegression: record.executedRegression,
          executedSmoke: record.executedSmoke,
          executedExploratory: record.executedExploratory,
          defectsCritical: record.defectsCritical,
          defectsHigh: record.defectsHigh,
          defectsMedium: record.defectsMedium,
          defectsLow: record.defectsLow,
        };

        const existing = await prisma.weeklyRecord.findUnique({
          where: {
            testerId_cycleId_weekStart: {
              testerId: record.testerId,
              cycleId: record.cycleId,
              weekStart: monday,
            },
          },
        });

        if (existing) {
          const updated = await prisma.weeklyRecord.update({
            where: { id: existing.id },
            data,
          });
          results.push({ ...updated, action: "updated" });
        } else {
          const created = await prisma.weeklyRecord.create({
            data: {
              testerId: record.testerId,
              cycleId: record.cycleId,
              weekStart: monday,
              ...data,
              source: "MANUAL",
            },
          });
          results.push({ ...created, action: "created" });
        }
      }

      res.status(201).json({ results, count: results.length });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      res.status(500).json({ error: "Error al guardar los registros" });
    }
  }
);

// POST /import — Parse Excel/CSV, validate, return preview
router.post(
  "/import",
  requirePermission("records", "create") as any,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      const projectId = req.body.projectId as string | undefined;

      if (!file) {
        res.status(400).json({ error: "No se envio ningun archivo" });
        return;
      }
      if (!projectId) {
        res.status(400).json({ error: "No se envio el ID del proyecto" });
        return;
      }

      // Verify project exists and is MANUAL
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, modality: true },
      });
      if (!project) {
        res.status(404).json({ error: "Proyecto no encontrado" });
        return;
      }
      if (project.modality !== "MANUAL") {
        res.status(400).json({
          error: "Solo se puede importar en proyectos con modalidad MANUAL",
        });
        return;
      }

      // Parse file
      const fileName = file.originalname.toLowerCase();
      let rawRows: RawRow[];

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        rawRows = await parseExcelFile(file.buffer);
      } else if (fileName.endsWith(".csv")) {
        rawRows = parseCsvFile(file.buffer.toString("utf-8"));
      } else {
        res.status(400).json({
          error: "Formato de archivo no soportado. Use .xlsx o .csv",
        });
        return;
      }

      if (rawRows.length === 0) {
        res.status(400).json({ error: "El archivo no contiene datos" });
        return;
      }

      // Load project testers and cycles for validation
      const [testers, cycles] = await Promise.all([
        prisma.tester.findMany({
          where: { projectId },
          select: { id: true, name: true },
        }),
        prisma.testCycle.findMany({
          where: { projectId },
          select: { id: true, name: true },
        }),
      ]);

      const testerByName = new Map(
        testers.map((t) => [t.name.toLowerCase().trim(), t])
      );
      const cycleByName = new Map(
        cycles.map((c) => [c.name.toLowerCase().trim(), c])
      );

      const NUMERIC_FIELDS = [
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

      interface RowError {
        row: number;
        column: string;
        message: string;
      }
      interface RowWarning {
        row: number;
        column: string;
        message: string;
      }
      interface ValidRow {
        row: number;
        data: {
          testerId: string;
          testerName: string;
          cycleId: string;
          cycleName: string;
          weekStart: string;
          designedFunctional: number;
          designedRegression: number;
          designedSmoke: number;
          designedExploratory: number;
          executedFunctional: number;
          executedRegression: number;
          executedSmoke: number;
          executedExploratory: number;
          defectsCritical: number;
          defectsHigh: number;
          defectsMedium: number;
          defectsLow: number;
        };
      }

      const valid: ValidRow[] = [];
      const errors: RowError[] = [];
      const warnings: RowWarning[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        const rowNum = i + 2; // 1-based, skip header
        let rowHasError = false;

        // Validate tester_name
        const tester = testerByName.get(raw.tester_name.toLowerCase().trim());
        if (!raw.tester_name.trim()) {
          errors.push({
            row: rowNum,
            column: "tester_name",
            message: "Nombre del tester es requerido",
          });
          rowHasError = true;
        } else if (!tester) {
          errors.push({
            row: rowNum,
            column: "tester_name",
            message: `Tester "${raw.tester_name}" no existe en el proyecto`,
          });
          rowHasError = true;
        }

        // Validate cycle
        const cycle = cycleByName.get(raw.cycle.toLowerCase().trim());
        if (!raw.cycle.trim()) {
          errors.push({
            row: rowNum,
            column: "cycle",
            message: "Nombre del ciclo es requerido",
          });
          rowHasError = true;
        } else if (!cycle) {
          errors.push({
            row: rowNum,
            column: "cycle",
            message: `Ciclo "${raw.cycle}" no existe en el proyecto`,
          });
          rowHasError = true;
        }

        // Validate week_start
        let weekStartDate: Date | null = null;
        if (!raw.week_start.trim()) {
          errors.push({
            row: rowNum,
            column: "week_start",
            message: "Fecha de inicio de semana es requerida",
          });
          rowHasError = true;
        } else {
          const parsed = new Date(raw.week_start + "T00:00:00");
          if (isNaN(parsed.getTime())) {
            errors.push({
              row: rowNum,
              column: "week_start",
              message: `Fecha "${raw.week_start}" no es valida. Use formato YYYY-MM-DD`,
            });
            rowHasError = true;
          } else if (!isMonday(parsed)) {
            warnings.push({
              row: rowNum,
              column: "week_start",
              message: `La fecha ${raw.week_start} no es lunes. Se ajustara al lunes ${getMonday(parsed).toISOString().split("T")[0]}`,
            });
            weekStartDate = getMonday(parsed);
          } else {
            weekStartDate = parsed;
          }
        }

        // Validate numeric fields
        for (const field of NUMERIC_FIELDS) {
          const val = raw[field];
          if (val < 0) {
            errors.push({
              row: rowNum,
              column: field,
              message: `El valor de ${field} no puede ser negativo`,
            });
            rowHasError = true;
          }
        }

        // Check for duplicates in DB
        if (tester && cycle && weekStartDate && !rowHasError) {
          const monday = getMonday(weekStartDate);
          const existing = await prisma.weeklyRecord.findUnique({
            where: {
              testerId_cycleId_weekStart: {
                testerId: tester.id,
                cycleId: cycle.id,
                weekStart: monday,
              },
            },
            select: { id: true },
          });

          if (existing) {
            warnings.push({
              row: rowNum,
              column: "general",
              message: `Ya existe un registro para ${raw.tester_name} en ${raw.cycle} semana ${raw.week_start}. Se actualizara.`,
            });
          }

          valid.push({
            row: rowNum,
            data: {
              testerId: tester.id,
              testerName: tester.name,
              cycleId: cycle.id,
              cycleName: cycle.name,
              weekStart: monday.toISOString().split("T")[0],
              designedFunctional: raw.designed_functional,
              designedRegression: raw.designed_regression,
              designedSmoke: raw.designed_smoke,
              designedExploratory: raw.designed_exploratory,
              executedFunctional: raw.executed_functional,
              executedRegression: raw.executed_regression,
              executedSmoke: raw.executed_smoke,
              executedExploratory: raw.executed_exploratory,
              defectsCritical: raw.defects_critical,
              defectsHigh: raw.defects_high,
              defectsMedium: raw.defects_medium,
              defectsLow: raw.defects_low,
            },
          });
        }
      }

      res.json({
        valid,
        errors,
        warnings,
        summary: {
          total: rawRows.length,
          valid: valid.length,
          errors: errors.length,
          warnings: warnings.length,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al procesar el archivo";
      res.status(500).json({ error: message });
    }
  }
);

// POST /import/confirm — Confirm import, upsert all records
router.post(
  "/import/confirm",
  requirePermission("records", "create") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, records } = req.body as {
        projectId: string;
        records: Array<{
          testerId: string;
          cycleId: string;
          weekStart: string;
          designedFunctional: number;
          designedRegression: number;
          designedSmoke: number;
          designedExploratory: number;
          executedFunctional: number;
          executedRegression: number;
          executedSmoke: number;
          executedExploratory: number;
          defectsCritical: number;
          defectsHigh: number;
          defectsMedium: number;
          defectsLow: number;
        }>;
      };

      if (!projectId) {
        res.status(400).json({ error: "projectId es requerido" });
        return;
      }
      if (!records || !Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: "No hay registros para importar" });
        return;
      }

      const results = [];
      let created = 0;
      let updated = 0;

      for (const record of records) {
        const monday = getMonday(new Date(record.weekStart + "T00:00:00"));

        const designedTotal =
          record.designedFunctional +
          record.designedRegression +
          record.designedSmoke +
          record.designedExploratory;
        const executedTotal =
          record.executedFunctional +
          record.executedRegression +
          record.executedSmoke +
          record.executedExploratory;

        const data = {
          designedTotal,
          designedFunctional: record.designedFunctional,
          designedRegression: record.designedRegression,
          designedSmoke: record.designedSmoke,
          designedExploratory: record.designedExploratory,
          executedTotal,
          executedFunctional: record.executedFunctional,
          executedRegression: record.executedRegression,
          executedSmoke: record.executedSmoke,
          executedExploratory: record.executedExploratory,
          defectsCritical: record.defectsCritical,
          defectsHigh: record.defectsHigh,
          defectsMedium: record.defectsMedium,
          defectsLow: record.defectsLow,
          source: "IMPORT",
        };

        const result = await prisma.weeklyRecord.upsert({
          where: {
            testerId_cycleId_weekStart: {
              testerId: record.testerId,
              cycleId: record.cycleId,
              weekStart: monday,
            },
          },
          create: {
            testerId: record.testerId,
            cycleId: record.cycleId,
            weekStart: monday,
            ...data,
          },
          update: data,
        });

        const isNew =
          result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) created++;
        else updated++;

        results.push(result);
      }

      res.status(201).json({
        count: results.length,
        created,
        updated,
        message: `Importacion completada: ${created} creados, ${updated} actualizados.`,
      });
    } catch (err) {
      res.status(500).json({ error: "Error al confirmar la importacion" });
    }
  }
);

// GET /templates/download — Generate and return Excel template
router.get(
  "/templates/download",
  requirePermission("records", "read") as any,
  async (_req: AuthRequest, res: Response) => {
    try {
      const COLUMNS = [
        { header: "tester_name", key: "tester_name", width: 20 },
        { header: "cycle", key: "cycle", width: 18 },
        { header: "week_start", key: "week_start", width: 14 },
        { header: "designed_functional", key: "designed_functional", width: 20 },
        { header: "designed_regression", key: "designed_regression", width: 20 },
        { header: "designed_smoke", key: "designed_smoke", width: 16 },
        { header: "designed_exploratory", key: "designed_exploratory", width: 22 },
        { header: "executed_functional", key: "executed_functional", width: 20 },
        { header: "executed_regression", key: "executed_regression", width: 20 },
        { header: "executed_smoke", key: "executed_smoke", width: 16 },
        { header: "executed_exploratory", key: "executed_exploratory", width: 22 },
        { header: "defects_critical", key: "defects_critical", width: 18 },
        { header: "defects_high", key: "defects_high", width: 14 },
        { header: "defects_medium", key: "defects_medium", width: 16 },
        { header: "defects_low", key: "defects_low", width: 14 },
      ];

      const EXAMPLE_ROW = {
        tester_name: "Juan Perez",
        cycle: "Ciclo 1 - Sprint 3",
        week_start: "2026-04-06",
        designed_functional: 15,
        designed_regression: 8,
        designed_smoke: 5,
        designed_exploratory: 3,
        executed_functional: 12,
        executed_regression: 7,
        executed_smoke: 5,
        executed_exploratory: 2,
        defects_critical: 1,
        defects_high: 3,
        defects_medium: 5,
        defects_low: 2,
      };

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Plantilla");
      sheet.columns = COLUMNS;

      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F3864" },
        };
        cell.font = {
          color: { argb: "FFFFFFFF" },
          bold: true,
          size: 11,
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      headerRow.height = 25;

      sheet.addRow(EXAMPLE_ROW);

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="plantilla_carga_qa.xlsx"'
      );
      res.send(Buffer.from(buffer));
    } catch (err) {
      res.status(500).json({ error: "Error al generar la plantilla" });
    }
  }
);

export default router;
