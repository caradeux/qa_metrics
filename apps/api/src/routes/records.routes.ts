import { Router, Response } from "express";
import multer from "multer";
import { startOfDay } from "date-fns";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import {
  parseDailyExcelFile,
  parseDailyCsvFile,
  generateDailyTemplate,
  type RawDailyRow,
} from "../services/excel-parser.js";

const router = Router();
router.use(authMiddleware as any);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface PreviewIssue {
  row: number;
  error: string;
}

interface ValidRow {
  row: number;
  testerId: string;
  testerEmail: string;
  date: string;
  designed: number;
  executed: number;
  defects: number;
}

// GET /api/records/templates/download
router.get("/templates/download", async (_req: AuthRequest, res: Response) => {
  try {
    const buffer = await generateDailyTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="plantilla_registros_diarios.xlsx"`
    );
    res.send(buffer);
  } catch {
    res.status(500).json({ error: "Error al generar la plantilla" });
  }
});

async function validateAndResolve(
  rows: RawDailyRow[],
  req: AuthRequest
): Promise<{ valid: ValidRow[]; errors: PreviewIssue[] }> {
  const valid: ValidRow[] = [];
  const errors: PreviewIssue[] = [];

  const roleName = req.user?.role?.name;
  const isLead = roleName === "ADMIN" || roleName === "QA_LEAD";
  const today = startOfDay(new Date());

  // Preload testers + cycles + holidays
  const emails = [...new Set(rows.map((r) => r.tester_email.toLowerCase()).filter(Boolean))];
  const testers = await prisma.tester.findMany({
    where: { user: { email: { in: emails } } },
    include: { user: { select: { id: true, email: true } } },
  });
  const testerByEmail = new Map<string, (typeof testers)[number]>();
  for (const t of testers) {
    if (t.user?.email) testerByEmail.set(t.user.email.toLowerCase(), t);
  }

  const allDates = rows
    .map((r) => r.date)
    .filter(Boolean)
    .map((d) => {
      const parsed = new Date(d + "T00:00:00");
      return isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter((d): d is Date => d !== null);

  const holidays = allDates.length > 0
    ? await prisma.holiday.findMany({ where: { date: { in: allDates } } })
    : [];
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // header is row 1
    if (!r.tester_email) {
      errors.push({ row: rowNum, error: "tester_email vacio" });
      return;
    }
    const tester = testerByEmail.get(r.tester_email.toLowerCase());
    if (!tester) {
      errors.push({ row: rowNum, error: `tester_email no encontrado: ${r.tester_email}` });
      return;
    }
    // Permissions: QA_ANALYST solo puede subir el suyo
    if (!isLead && tester.user?.id !== req.user?.id) {
      errors.push({ row: rowNum, error: "sin permiso para cargar datos de otro tester" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      errors.push({ row: rowNum, error: `fecha invalida: ${r.date}` });
      return;
    }
    const dateObj = new Date(r.date + "T00:00:00");
    if (isNaN(dateObj.getTime())) {
      errors.push({ row: rowNum, error: `fecha invalida: ${r.date}` });
      return;
    }
    if (dateObj > today) {
      errors.push({ row: rowNum, error: "fecha futura no permitida" });
      return;
    }
    if (holidaySet.has(r.date)) {
      errors.push({ row: rowNum, error: "fecha corresponde a feriado" });
      return;
    }
    if (r.designed < 0 || r.executed < 0 || r.defects < 0) {
      errors.push({ row: rowNum, error: "valores negativos no permitidos" });
      return;
    }
    valid.push({
      row: rowNum,
      testerId: tester.id,
      testerEmail: r.tester_email,
      date: r.date,
      designed: r.designed,
      executed: r.executed,
      defects: r.defects,
    });
  });

  return { valid, errors };
}

// POST /api/records/import — parse + validate, return preview
router.post(
  "/import",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "archivo requerido" });
        return;
      }
      const name = req.file.originalname.toLowerCase();
      let rawRows: RawDailyRow[];
      if (name.endsWith(".xlsx")) {
        rawRows = await parseDailyExcelFile(req.file.buffer);
      } else if (name.endsWith(".csv")) {
        rawRows = parseDailyCsvFile(req.file.buffer.toString("utf-8"));
      } else {
        res.status(400).json({ error: "formato no soportado (solo .xlsx o .csv)" });
        return;
      }
      const { valid, errors } = await validateAndResolve(rawRows, req);
      res.json({
        valid,
        errors,
        summary: {
          total: rawRows.length,
          valid: valid.length,
          errors: errors.length,
        },
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Error al procesar archivo" });
    }
  }
);

// POST /api/records/import/confirm — apply upsert
router.post("/import/confirm", async (req: AuthRequest, res: Response) => {
  try {
    const records = req.body?.records as ValidRow[] | undefined;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "sin registros para importar" });
      return;
    }
    // Re-check permissions row by row
    const roleName = req.user?.role?.name;
    const isLead = roleName === "ADMIN" || roleName === "QA_LEAD";

    if (!isLead) {
      const testerIds = [...new Set(records.map((r) => r.testerId))];
      const owned = await prisma.tester.findMany({
        where: { id: { in: testerIds }, userId: req.user!.id },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((o) => o.id));
      if (testerIds.some((id) => !ownedSet.has(id))) {
        res.status(403).json({ error: "sin permiso para cargar datos de otro tester" });
        return;
      }
    }

    // TODO: el upload Excel requiere ahora una columna HU (assignmentId/externalId)
    // para resolver la asignación. Deshabilitado temporalmente tras refactor a
    // DailyRecord por asignación.
    void records;
    res.status(501).json({
      error:
        "Importación Excel pendiente de actualización: ahora cada registro requiere una HU asignada. Usa el formulario semanal.",
    });
    return;
  } catch (err: any) {
    res.status(500).json({ error: "Error al confirmar la importacion" });
  }
});

export default router;
