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
          story: {
            select: {
              id: true,
              title: true,
              complexity: true,
              cycle: { select: { name: true } },
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

      const assignment = await prisma.testerAssignment.create({
        data: {
          testerId: data.testerId,
          storyId: data.storyId,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          executionCycle: data.executionCycle || null,
          notes: data.notes || null,
        },
        include: {
          tester: { select: { name: true } },
          story: { select: { title: true } },
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
        res.status(409).json({ error: "Este tester ya esta asignado a esta HU" });
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

      const data: Record<string, unknown> = {};
      if (body.status) {
        data.status = body.status;
        // Auto-set endDate when status is PRODUCTION
        if (body.status === "PRODUCTION" && !body.endDate) {
          data.endDate = new Date();
        }
      }
      if (body.endDate !== undefined)
        data.endDate = body.endDate ? new Date(body.endDate) : null;
      if (body.executionCycle !== undefined)
        data.executionCycle = body.executionCycle || null;
      if (body.notes !== undefined) data.notes = body.notes;

      const updated = await prisma.testerAssignment.update({
        where: { id },
        data,
      });

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
