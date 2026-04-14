import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createTesterSchema, updateTesterSchema } from "../validators/tester.validator.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET /me — current authenticated user's tester profile
router.get("/me", async (req: AuthRequest, res: Response) => {
  const t = await prisma.tester.findFirst({
    where: { userId: req.user!.id },
    select: { id: true, projectId: true, name: true },
  });
  if (!t) {
    res.status(404).json({ error: "not a tester" });
    return;
  }
  res.json(t);
});

// GET /:id — fetch one tester (minimal, for week views)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const t = await prisma.tester.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true },
  });
  if (!t) {
    res.status(404).json({ error: "Tester no encontrado" });
    return;
  }
  res.json(t);
});

// GET / — list testers, required ?projectId filter
router.get("/", requirePermission("testers", "read") as any, async (req: AuthRequest, res: Response) => {
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

    const testers = await prisma.tester.findMany({
      where: { projectId },
      include: {
        _count: { select: { records: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(testers);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener testers" });
  }
});

// POST / — create tester
router.post("/", requirePermission("testers", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTesterSchema.parse(req.body);

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, client: { userId: req.user!.id } },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const tester = await prisma.tester.create({
      data: {
        name: data.name,
        projectId: data.projectId,
      },
    });
    res.status(201).json(tester);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear tester" });
  }
});

// PUT /:id — update tester name
router.put("/:id", requirePermission("testers", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateTesterSchema.parse(req.body);

    const existing = await prisma.tester.findFirst({
      where: { id, project: { client: { userId: req.user!.id } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Tester no encontrado" });
      return;
    }

    const tester = await prisma.tester.update({
      where: { id },
      data: { name: data.name },
    });
    res.json(tester);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar tester" });
  }
});

// DELETE /:id — delete (409 if has records)
router.delete("/:id", requirePermission("testers", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.tester.findFirst({
      where: { id, project: { client: { userId: req.user!.id } } },
      include: { _count: { select: { records: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Tester no encontrado" });
      return;
    }
    if (existing._count.records > 0) {
      res.status(409).json({ error: "No se puede eliminar: el tester tiene registros asociados" });
      return;
    }

    await prisma.tester.delete({ where: { id } });
    res.json({ message: "Tester eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar tester" });
  }
});

export default router;
