import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createCycleSchema, updateCycleSchema } from "../validators/cycle.validator.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import { isWorkday } from "../lib/workdays.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessStory(req: AuthRequest, storyId: string): Promise<boolean> {
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: { projectId: true },
  });
  if (!story) return false;
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(story.projectId);
  }
  const project = await prisma.project.findFirst({
    where: { id: story.projectId, OR: [{ client: { userId: req.user!.id } }, { testers: { some: { userId: req.user!.id } } }] as any },
    select: { id: true },
  });
  return !!project;
}

// GET / — list cycles for a story (?storyId=X) or a project (?projectId=X — returns all cycles of project's stories)
router.get("/", requirePermission("cycles", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const storyId = req.query.storyId as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    if (!storyId && !projectId) {
      res.status(400).json({ error: "storyId o projectId es requerido" });
      return;
    }

    if (storyId) {
      if (!(await userCanAccessStory(req, storyId))) {
        res.status(404).json({ error: "Historia no encontrada" });
        return;
      }
      const cycles = await prisma.testCycle.findMany({
        where: { storyId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: "asc" },
      });
      res.json(cycles);
      return;
    }

    // projectId path: check access
    const projectWhere: any = { id: projectId };
    if (isClientPm(req)) projectWhere.projectManagerId = req.user!.id;
    else projectWhere.client = { userId: req.user!.id };
    const project = await prisma.project.findFirst({ where: projectWhere });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const cycles = await prisma.testCycle.findMany({
      where: { story: { projectId } },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    res.json(cycles);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener ciclos" });
  }
});

// POST / — create cycle for a story
router.post("/", requirePermission("cycles", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createCycleSchema.parse(req.body);

    if (!(await userCanAccessStory(req, data.storyId))) {
      res.status(404).json({ error: "Historia no encontrada" });
      return;
    }

    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (startDate && !(await isWorkday(startDate))) {
      res.status(400).json({ error: "La fecha de inicio debe ser un día hábil (L-V, no feriado)" });
      return;
    }
    if (endDate && !(await isWorkday(endDate))) {
      res.status(400).json({ error: "La fecha de fin debe ser un día hábil (L-V, no feriado)" });
      return;
    }

    const cycle = await prisma.testCycle.create({
      data: {
        name: data.name,
        storyId: data.storyId,
        startDate,
        endDate,
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
      where: { id, story: { project: { OR: [{ client: { userId: req.user!.id } }, { testers: { some: { userId: req.user!.id } } }] as any } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Ciclo no encontrado" });
      return;
    }

    if (data.startDate) {
      const sd = new Date(data.startDate);
      if (!(await isWorkday(sd))) {
        res.status(400).json({ error: "La fecha de inicio debe ser un día hábil (L-V, no feriado)" });
        return;
      }
    }
    if (data.endDate) {
      const ed = new Date(data.endDate);
      if (!(await isWorkday(ed))) {
        res.status(400).json({ error: "La fecha de fin debe ser un día hábil (L-V, no feriado)" });
        return;
      }
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

// DELETE /:id — delete cycle and cascade assignments (and their logs/phases/daily records)
router.delete("/:id", requirePermission("cycles", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.testCycle.findFirst({
      where: { id, story: { project: { OR: [{ client: { userId: req.user!.id } }, { testers: { some: { userId: req.user!.id } } }] as any } } },
      include: { _count: { select: { assignments: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Ciclo no encontrado" });
      return;
    }

    // Cascada manual: los assignments tienen onDelete: Cascade a statusLogs/phases/dailyRecords,
    // así que basta con borrar los assignments y luego el ciclo.
    await prisma.$transaction([
      prisma.testerAssignment.deleteMany({ where: { cycleId: id } }),
      prisma.testCycle.delete({ where: { id } }),
    ]);

    res.json({
      message: "Ciclo eliminado",
      deletedAssignments: existing._count.assignments,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar ciclo" });
  }
});

export default router;
