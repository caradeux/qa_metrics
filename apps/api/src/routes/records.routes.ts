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
  projectId: string;
  projectName: string;
  storyId: string;
  storyTitle: string;
  cycleId: string;
  cycleName: string;
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

  // Preload testers (por email del user vinculado)
  const emails = [...new Set(rows.map((r) => r.tester_email.toLowerCase()).filter(Boolean))];
  const testers = emails.length
    ? await prisma.tester.findMany({
        where: { user: { email: { in: emails } } },
        include: {
          user: { select: { id: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      })
    : [];
  // Un user puede tener multiples testers (uno por proyecto); indexamos por email -> lista
  const testersByEmail = new Map<string, typeof testers>();
  for (const t of testers) {
    if (!t.user?.email) continue;
    const k = t.user.email.toLowerCase();
    const arr = testersByEmail.get(k) ?? [];
    arr.push(t);
    testersByEmail.set(k, arr);
  }

  // Preload stories por proyecto+titulo
  const projectNames = [...new Set(rows.map((r) => r.project_name).filter(Boolean))];
  const projects = projectNames.length
    ? await prisma.project.findMany({ where: { name: { in: projectNames } } })
    : [];
  const projectByName = new Map(projects.map((p) => [p.name, p]));

  const stories = projects.length
    ? await prisma.userStory.findMany({
        where: { projectId: { in: projects.map((p) => p.id) } },
        include: { cycles: { orderBy: { startDate: "asc" } } },
      })
    : [];
  const storyKey = (projectId: string, title: string) => `${projectId}::${title}`;
  const storyByKey = new Map(stories.map((s) => [storyKey(s.projectId, s.title), s]));

  // Preload feriados
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
    const rowNum = idx + 2; // header es fila 1
    if (!r.tester_email) { errors.push({ row: rowNum, error: "tester_email vacio" }); return; }
    if (!r.project_name) { errors.push({ row: rowNum, error: "project_name vacio" }); return; }
    if (!r.story_title)  { errors.push({ row: rowNum, error: "story_title vacio" }); return; }

    const project = projectByName.get(r.project_name);
    if (!project) {
      errors.push({ row: rowNum, error: `proyecto no encontrado: ${r.project_name}` });
      return;
    }

    const testerCandidates = testersByEmail.get(r.tester_email.toLowerCase()) ?? [];
    const tester = testerCandidates.find((t) => t.projectId === project.id);
    if (!tester) {
      errors.push({ row: rowNum, error: `tester ${r.tester_email} no pertenece al proyecto ${r.project_name}` });
      return;
    }

    // Permisos: QA_ANALYST solo el suyo
    if (!isLead && tester.user?.id !== req.user?.id) {
      errors.push({ row: rowNum, error: "sin permiso para cargar datos de otro tester" });
      return;
    }

    const story = storyByKey.get(storyKey(project.id, r.story_title));
    if (!story) {
      errors.push({ row: rowNum, error: `HU no encontrada en el proyecto: ${r.story_title}` });
      return;
    }

    let cycle = null as null | { id: string; name: string };
    if (r.cycle_name) {
      const match = story.cycles.find((c) => c.name === r.cycle_name);
      if (!match) {
        errors.push({ row: rowNum, error: `ciclo "${r.cycle_name}" no encontrado en la HU` });
        return;
      }
      cycle = match;
    } else {
      if (story.cycles.length === 0) {
        errors.push({ row: rowNum, error: "la HU no tiene ciclos definidos; especifica cycle_name" });
        return;
      }
      cycle = story.cycles[0]!;
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
    // L-V (UTC-agnostic: usamos dia local del objeto construido)
    const dow = dateObj.getDay();
    if (dow === 0 || dow === 6) {
      errors.push({ row: rowNum, error: "fecha corresponde a fin de semana" });
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
      projectId: project.id,
      projectName: project.name,
      storyId: story.id,
      storyTitle: story.title,
      cycleId: cycle.id,
      cycleName: cycle.name,
      date: r.date,
      designed: r.designed,
      executed: r.executed,
      defects: r.defects,
    });
  });

  return { valid, errors };
}

// POST /api/records/import — parse + validate (preview)
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

// Alias: POST /api/records/import/preview
router.post(
  "/import/preview",
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

      // Forma alterna tipo { rows, validCount, errorCount } pedida en la tarea
      const errorsByRow = new Map<number, string[]>();
      for (const e of errors) {
        const arr = errorsByRow.get(e.row) ?? [];
        arr.push(e.error);
        errorsByRow.set(e.row, arr);
      }
      const rows: Array<
        | { row: number; valid: true; resolved: { testerId: string; storyId: string; cycleId: string; date: string } }
        | { row: number; valid: false; errors: string[] }
      > = [];
      for (const v of valid) {
        rows.push({
          row: v.row,
          valid: true,
          resolved: { testerId: v.testerId, storyId: v.storyId, cycleId: v.cycleId, date: v.date },
        });
      }
      for (const [row, errs] of errorsByRow) {
        rows.push({ row, valid: false, errors: errs });
      }
      rows.sort((a, b) => a.row - b.row);

      res.json({
        valid,
        errors,
        rows,
        validCount: valid.length,
        errorCount: errors.length,
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

// POST /api/records/import/confirm
router.post("/import/confirm", async (req: AuthRequest, res: Response) => {
  try {
    const records = req.body?.records as ValidRow[] | undefined;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "sin registros para importar" });
      return;
    }

    // Re-check permisos
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

    let assignmentsCreated = 0;
    let recordsUpserted = 0;

    await prisma.$transaction(async (tx) => {
      // Resolver asignaciones (crear si faltan)
      const assignKey = (r: ValidRow) => `${r.testerId}::${r.storyId}::${r.cycleId}`;
      const neededKeys = [...new Set(records.map(assignKey))];
      const assignmentByKey = new Map<string, { id: string }>();

      // Precargar existentes
      const existing = await tx.testerAssignment.findMany({
        where: {
          OR: records.map((r) => ({
            testerId: r.testerId,
            storyId: r.storyId,
            cycleId: r.cycleId,
          })),
        },
        select: { id: true, testerId: true, storyId: true, cycleId: true },
      });
      for (const a of existing) {
        assignmentByKey.set(`${a.testerId}::${a.storyId}::${a.cycleId}`, { id: a.id });
      }

      for (const key of neededKeys) {
        if (assignmentByKey.has(key)) continue;
        const sample = records.find((r) => assignKey(r) === key)!;
        const created = await tx.testerAssignment.create({
          data: {
            testerId: sample.testerId,
            storyId: sample.storyId,
            cycleId: sample.cycleId,
            startDate: new Date(sample.date + "T00:00:00"),
            status: "REGISTERED",
            notes: "Creado automaticamente por importacion Excel",
          },
        });
        await tx.assignmentStatusLog.create({
          data: { assignmentId: created.id, status: "REGISTERED" },
        });
        assignmentByKey.set(key, { id: created.id });
        assignmentsCreated++;
      }

      // Upsert DailyRecords
      for (const r of records) {
        const assignment = assignmentByKey.get(assignKey(r))!;
        const date = new Date(r.date + "T00:00:00");
        await tx.dailyRecord.upsert({
          where: {
            assignmentId_date: { assignmentId: assignment.id, date },
          },
          update: {
            designed: r.designed,
            executed: r.executed,
            defects: r.defects,
            source: "MANUAL",
          },
          create: {
            testerId: r.testerId,
            assignmentId: assignment.id,
            date,
            designed: r.designed,
            executed: r.executed,
            defects: r.defects,
            source: "MANUAL",
          },
        });
        recordsUpserted++;
      }
    });

    res.json({
      message: `Importacion completada: ${recordsUpserted} registros, ${assignmentsCreated} asignaciones creadas.`,
      recordsUpserted,
      assignmentsCreated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error al confirmar la importacion" });
  }
});

export default router;
