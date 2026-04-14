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
import { ZodError } from "zod";
import { isClientPm, clientPmProjectIds } from "../lib/access.js";
import { isWorkday } from "../lib/workdays.js";

const router = Router();
router.use(authMiddleware as any);

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

      const startDate = data.startDate ? new Date(data.startDate) : new Date();
      const endDate = data.endDate ? new Date(data.endDate) : null;
      if (!(await isWorkday(startDate))) {
        res.status(400).json({ error: "La fecha de inicio debe ser un día hábil (L-V, no feriado)" });
        return;
      }
      if (endDate && !(await isWorkday(endDate))) {
        res.status(400).json({ error: "La fecha de fin debe ser un día hábil (L-V, no feriado)" });
        return;
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
        },
        include: {
          tester: { select: { name: true } },
          story: { select: { title: true } },
          cycle: { select: { id: true, name: true } },
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
      await prisma.testerAssignment.delete({ where: { id } });
      res.json({ message: "Asignacion eliminada" });
    } catch (err) {
      res.status(500).json({ error: "Error al eliminar la asignacion" });
    }
  }
);

export default router;
