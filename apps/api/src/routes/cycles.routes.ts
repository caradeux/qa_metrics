import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createCycleSchema, updateCycleSchema } from "../validators/cycle.validator.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET / — list cycles, required ?projectId filter
router.get("/", requirePermission("cycles", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId es requerido" });
      return;
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { userId: req.user!.id } },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const cycles = await prisma.testCycle.findMany({
      where: { projectId },
      include: {
        _count: { select: { records: true, stories: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(cycles);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener ciclos" });
  }
});

// POST / — create cycle
router.post("/", requirePermission("cycles", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    const data = createCycleSchema.parse(req.body);

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, client: { userId: req.user!.id } },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const cycle = await prisma.testCycle.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
    res.status(201).json(cycle);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear ciclo" });
  }
});

// PUT /:id — update cycle
router.put("/:id", requirePermission("cycles", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateCycleSchema.parse(req.body);

    const existing = await prisma.testCycle.findFirst({
      where: { id, project: { client: { userId: req.user!.id } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Ciclo no encontrado" });
      return;
    }

    const cycle = await prisma.testCycle.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
      },
    });
    res.json(cycle);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar ciclo" });
  }
});

// DELETE /:id — delete (409 if has records)
router.delete("/:id", requirePermission("cycles", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.testCycle.findFirst({
      where: { id, project: { client: { userId: req.user!.id } } },
      include: { _count: { select: { records: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Ciclo no encontrado" });
      return;
    }
    if (existing._count.records > 0) {
      res.status(409).json({ error: "No se puede eliminar: el ciclo tiene registros asociados" });
      return;
    }

    await prisma.testCycle.delete({ where: { id } });
    res.json({ message: "Ciclo eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar ciclo" });
  }
});

export default router;
