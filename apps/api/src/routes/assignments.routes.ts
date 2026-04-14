import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../validators/assignment.validator.js";
import { updatePhasesSchema } from "../validators/assignment-phase.validator.js";
import { ZodError } from "zod";
import { isClientPm, isAnalyst, clientPmProjectIds, analystProjectIds } from "../lib/access.js";
import { isWorkday } from "../lib/workdays.js";

const router = Router();
router.use(authMiddleware as any);

async function canAccessAssignmentProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  if (isAnalyst(req)) {
    const ids = await analystProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  // ADMIN / QA_LEAD
  const p = await prisma.project.findFirst({
    where: { id: projectId, client: { userId: req.user!.id } },
    select: { id: true },
  });
  return !!p;
}

async function assertCanActOnAssignment(req: AuthRequest, assignmentId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const a = await prisma.testerAssignment.findUnique({
    where: { id: assignmentId },
    select: { tester: { select: { projectId: true } } },
  });
  if (!a) return { ok: false, status: 404, error: "Asignacion no encontrada" };
  const allowed = await canAccessAssignmentProject(req, a.tester.projectId);
  if (!allowed) return { ok: false, status: 403, error: "Sin acceso" };
  return { ok: true };
}

// GET / — List assignments with filters
router.get(
  "/",
  requirePermission("assignments", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, cycleId, status, testerId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

      const where: Record<string, unknown> = {};
      if (projectId) where.tester = { projectId };
      if (cycleId) where.cycleId = cycleId;
      if (status) where.status = status;
      if (testerId) where.testerId = testerId;

      if (isClientPm(req)) {
        const ids = await clientPmProjectIds(req.user!.id);
        if (projectId && !ids.includes(projectId)) {
          res.status(403).json({ error: "Sin acceso" });
          return;
        }
        where.tester = { projectId: projectId ? projectId : { in: ids } };
      } else if (isAnalyst(req)) {
        const ids = await analystProjectIds(req.user!.id);
        if (projectId && !ids.includes(projectId)) {
          res.status(403).json({ error: "Sin acceso" });
          return;
        }
        where.tester = { projectId: projectId ? projectId : { in: ids } };
      }

      // Date range overlap filter: assignment overlaps [dateFrom, dateTo] if
      // startDate <= dateTo AND (endDate IS NULL OR endDate >= dateFrom)
      if (dateFrom || dateTo) {
        const and: Record<string, unknown>[] = [];
        if (dateTo) and.push({ startDate: { lte: new Date(dateTo) } });
        if (dateFrom) {
          and.push({
            OR: [
              { endDate: null },
              { endDate: { gte: new Date(dateFrom) } },
            ],
          });
        }
        where.AND = and;
      }

      const assignments = await prisma.testerAssignment.findMany({
        where,
        include: {
          tester: {
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  client: { select: { name: true } },
                },
              },
            },
          },
          cycle: { select: { id: true, name: true } },
          story: {
            select: {
              id: true,
              title: true,
              externalId: true,
              designComplexity: true,
              executionComplexity: true,
            },
          },
          phases: {
            select: { id: true, phase: true, startDate: true, endDate: true },
            orderBy: { startDate: "asc" },
          },
        },
        orderBy: { startDate: "desc" },
      });

      res.json(assignments);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener asignaciones" });
    }
  }
);

// POST / — Create assignment
router.post(
  "/",
  requirePermission("assignments", "create") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createAssignmentSchema.parse(req.body);
      const initialStatus = data.status ?? "REGISTERED";

      // Verify tester belongs to a project the user can access
      const tester = await prisma.tester.findUnique({
        where: { id: data.testerId },
        select: { projectId: true },
      });
      if (!tester) {
        res.status(404).json({ error: "Tester no encontrado" });
        return;
      }
      if (!(await canAccessAssignmentProject(req, tester.projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }

      let startDate = data.startDate ? new Date(data.startDate) : new Date();
      let endDate: Date | null = data.endDate ? new Date(data.endDate) : null;

      const phases = data.phases ?? [];
      if (phases.length > 0) {
        // Validate each phase
        for (const p of phases) {
          const ps = new Date(p.startDate);
          const pe = new Date(p.endDate);
          if (ps > pe) {
            res.status(400).json({ error: `Fase ${p.phase}: la fecha de inicio debe ser <= fecha de fin` });
            return;
          }
          if (!(await isWorkday(ps))) {
            res.status(400).json({ error: `Fase ${p.phase}: la fecha de inicio debe ser un día hábil (L-V, no feriado)` });
            return;
          }
          if (!(await isWorkday(pe))) {
            res.status(400).json({ error: `Fase ${p.phase}: la fecha de fin debe ser un día hábil (L-V, no feriado)` });
            return;
          }
        }
        // Overlap check
        const sorted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].startDate <= sorted[i - 1].endDate) {
            res.status(400).json({ error: "Las fases no pueden solaparse" });
            return;
          }
        }
        // Derive assignment start/end from phases
        const minStart = sorted[0].startDate;
        const maxEnd = sorted.reduce((acc, p) => (p.endDate > acc ? p.endDate : acc), sorted[0].endDate);
        startDate = new Date(minStart);
        endDate = new Date(maxEnd);
      } else {
        if (!(await isWorkday(startDate))) {
          res.status(400).json({ error: "La fecha de inicio debe ser un día hábil (L-V, no feriado)" });
          return;
        }
        if (endDate && !(await isWorkday(endDate))) {
          res.status(400).json({ error: "La fecha de fin debe ser un día hábil (L-V, no feriado)" });
          return;
        }
      }

      const assignment = await prisma.testerAssignment.create({
        data: {
          testerId: data.testerId,
          storyId: data.storyId,
          cycleId: data.cycleId,
          startDate,
          endDate,
          status: initialStatus,
          notes: data.notes || null,
          statusLogs: {
            create: { status: initialStatus },
          },
          ...(phases.length > 0 && {
            phases: {
              create: phases.map((p) => ({
                phase: p.phase,
                startDate: new Date(p.startDate),
                endDate: new Date(p.endDate),
              })),
            },
          }),
        },
        include: {
          tester: { select: { name: true } },
          story: { select: { title: true } },
          cycle: { select: { id: true, name: true } },
          phases: {
            select: { id: true, phase: true, startDate: true, endDate: true },
            orderBy: { startDate: "asc" },
          },
        },
      });

      res.status(201).json(assignment);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        res.status(409).json({ error: "Este tester ya esta asignado a esta HU en este ciclo" });
        return;
      }
      res.status(500).json({ error: "Error al crear la asignacion" });
    }
  }
);

// PUT /:id — Update assignment
router.put(
  "/:id",
  requirePermission("assignments", "update") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const body = updateAssignmentSchema.parse(req.body);

      const existing = await prisma.testerAssignment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Asignacion no encontrada" });
        return;
      }
      const check = await assertCanActOnAssignment(req, id);
      if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }

      const data: Record<string, unknown> = {};
      let statusChanged = false;
      if (body.status && body.status !== existing.status) {
        data.status = body.status;
        statusChanged = true;
        if (body.status === "PRODUCTION" && !body.endDate) {
          data.endDate = new Date();
        }
      }
      if (body.startDate !== undefined) {
        const sd = new Date(body.startDate);
        if (!(await isWorkday(sd))) {
          res.status(400).json({ error: "La fecha de inicio debe ser un día hábil (L-V, no feriado)" });
          return;
        }
        data.startDate = sd;
      }
      if (body.endDate !== undefined) {
        const ed = body.endDate ? new Date(body.endDate) : null;
        if (ed && !(await isWorkday(ed))) {
          res.status(400).json({ error: "La fecha de fin debe ser un día hábil (L-V, no feriado)" });
          return;
        }
        data.endDate = ed;
      }
      if (body.notes !== undefined) data.notes = body.notes;

      const updated = await prisma.testerAssignment.update({
        where: { id },
        data,
      });

      if (statusChanged) {
        await prisma.assignmentStatusLog.create({
          data: { assignmentId: id, status: body.status! },
        });
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      res.status(500).json({ error: "Error al actualizar la asignacion" });
    }
  }
);

// GET /:id/history — status log history
router.get(
  "/:id/history",
  requirePermission("assignments", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const check = await assertCanActOnAssignment(req, id);
      if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
      const logs = await prisma.assignmentStatusLog.findMany({
        where: { assignmentId: id },
        orderBy: { changedAt: "asc" },
      });
      res.json(logs);
    } catch {
      res.status(500).json({ error: "Error al obtener historial" });
    }
  }
);

// DELETE /:id — Delete assignment
router.delete(
  "/:id",
  requirePermission("assignments", "delete") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const check = await assertCanActOnAssignment(req, id);
      if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
      await prisma.testerAssignment.delete({ where: { id } });
      res.json({ message: "Asignacion eliminada" });
    } catch (err) {
      res.status(500).json({ error: "Error al eliminar la asignacion" });
    }
  }
);

// GET /:id — single assignment with phases
router.get(
  "/:id",
  requirePermission("assignments", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const check = await assertCanActOnAssignment(req, id);
      if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
      const assignment = await prisma.testerAssignment.findUnique({
        where: { id },
        include: {
          tester: {
            select: {
              id: true,
              name: true,
              project: { select: { id: true, name: true, client: { select: { name: true } } } },
            },
          },
          cycle: { select: { id: true, name: true } },
          story: {
            select: {
              id: true,
              title: true,
              externalId: true,
              designComplexity: true,
              executionComplexity: true,
            },
          },
          phases: {
            select: { id: true, phase: true, startDate: true, endDate: true },
            orderBy: { startDate: "asc" },
          },
        },
      });
      if (!assignment) {
        res.status(404).json({ error: "Asignacion no encontrada" });
        return;
      }
      res.json(assignment);
    } catch {
      res.status(500).json({ error: "Error al obtener la asignacion" });
    }
  }
);

// PUT /:id/phases — replace phases
router.put(
  "/:id/phases",
  requirePermission("assignments", "update") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const { phases } = updatePhasesSchema.parse(req.body);
      const phasesCheck = await assertCanActOnAssignment(req, id);
      if (!phasesCheck.ok) { res.status(phasesCheck.status).json({ error: phasesCheck.error }); return; }

      const existing = await prisma.testerAssignment.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Asignacion no encontrada" });
        return;
      }

      for (const p of phases) {
        const ps = new Date(p.startDate);
        const pe = new Date(p.endDate);
        if (ps > pe) {
          res.status(400).json({ error: `Fase ${p.phase}: la fecha de inicio debe ser <= fecha de fin` });
          return;
        }
        if (!(await isWorkday(ps))) {
          res.status(400).json({ error: `Fase ${p.phase}: la fecha de inicio debe ser un día hábil (L-V, no feriado)` });
          return;
        }
        if (!(await isWorkday(pe))) {
          res.status(400).json({ error: `Fase ${p.phase}: la fecha de fin debe ser un día hábil (L-V, no feriado)` });
          return;
        }
      }
      const sorted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].startDate <= sorted[i - 1].endDate) {
          res.status(400).json({ error: "Las fases no pueden solaparse" });
          return;
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.assignmentPhase.deleteMany({ where: { assignmentId: id } });
        if (phases.length > 0) {
          await tx.assignmentPhase.createMany({
            data: phases.map((p) => ({
              assignmentId: id,
              phase: p.phase,
              startDate: new Date(p.startDate),
              endDate: new Date(p.endDate),
            })),
          });
          const minStart = sorted[0].startDate;
          const maxEnd = sorted.reduce((acc, p) => (p.endDate > acc ? p.endDate : acc), sorted[0].endDate);
          await tx.testerAssignment.update({
            where: { id },
            data: { startDate: new Date(minStart), endDate: new Date(maxEnd) },
          });
        }
        return tx.testerAssignment.findUnique({
          where: { id },
          include: {
            phases: {
              select: { id: true, phase: true, startDate: true, endDate: true },
              orderBy: { startDate: "asc" },
            },
          },
        });
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      res.status(500).json({ error: "Error al actualizar las fases" });
    }
  }
);

export default router;
