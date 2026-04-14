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

const router = Router();
router.use(authMiddleware as any);

// GET / — List assignments with filters
router.get(
  "/",
  requirePermission("assignments", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.query;

      const where: Record<string, unknown> = {};
      if (projectId) where.tester = { projectId };

      if (isClientPm(req)) {
        const ids = await clientPmProjectIds(req.user!.id);
        if (projectId && !ids.includes(projectId as string)) {
          res.status(403).json({ error: "Sin acceso" });
          return;
        }
        where.tester = { projectId: projectId ? projectId : { in: ids } };
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

      const assignment = await prisma.testerAssignment.create({
        data: {
          testerId: data.testerId,
          storyId: data.storyId,
          cycleId: data.cycleId,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
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
      if (body.startDate !== undefined)
        data.startDate = new Date(body.startDate);
      if (body.endDate !== undefined)
        data.endDate = body.endDate ? new Date(body.endDate) : null;
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
