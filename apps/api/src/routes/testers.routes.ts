import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createTesterSchema, updateTesterSchema } from "../validators/tester.validator.js";
import { isClientPm } from "../lib/access.js";
import { ACTIVE_STATUSES } from "../lib/assignment-states.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET /me — current authenticated user's tester profiles (may be multiple across projects)
router.get("/me", async (req: AuthRequest, res: Response) => {
  const testers = await prisma.tester.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      projectId: true,
      name: true,
      allocation: true,
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
    },
    orderBy: { project: { name: "asc" } },
  });
  if (testers.length === 0) {
    res.status(404).json({ error: "not a tester" });
    return;
  }
  res.json(testers);
});

// GET /:id — fetch one tester (minimal, for week views)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const tester = await prisma.tester.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true, userId: true },
  });
  if (!tester) {
    res.status(404).json({ error: "Tester no encontrado" });
    return;
  }
  const roleName = req.user?.role?.name;
  if (roleName === "CLIENT_PM") {
    const own = await prisma.project.findFirst({
      where: { id: tester.projectId, projectManagerId: req.user!.id },
      select: { id: true },
    });
    if (!own) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  } else if (
    roleName !== "ADMIN" &&
    roleName !== "QA_LEAD" &&
    tester.userId !== req.user!.id
  ) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const { userId: _userId, ...safe } = tester;
  res.json(safe);
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
    const projectWhere: any = { id: projectId };
    if (isClientPm(req)) projectWhere.projectManagerId = req.user!.id;
    else projectWhere.client = { userId: req.user!.id };
    const project = await prisma.project.findFirst({ where: projectWhere });
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

    const requestedAllocation = data.allocation ?? 100;
    if (data.userId) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        include: {
          role: true,
          testers: {
            select: {
              allocation: true,
              projectId: true,
              assignments: {
                where: { status: { in: [...ACTIVE_STATUSES] } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!user) { res.status(400).json({ error: "Usuario no encontrado" }); return; }
      if (user.role.name !== "QA_ANALYST") { res.status(400).json({ error: "El usuario debe tener rol QA_ANALYST" }); return; }
      if (user.testers.some(t => t.projectId === data.projectId)) {
        res.status(409).json({ error: "Ese usuario ya está asignado a este proyecto" });
        return;
      }
      if (!user.allowOverallocation) {
        // Only count testers that currently have at least one ACTIVE assignment
        const currentSum = user.testers.reduce(
          (sum, t) => sum + (t.assignments.length > 0 ? t.allocation : 0),
          0
        );
        if (currentSum + requestedAllocation > 100) {
          res.status(409).json({ error: `Capacidad excedida: el usuario tiene ${currentSum}% asignado; quedan ${100 - currentSum}% disponibles` });
          return;
        }
      }
    }

    const tester = await prisma.tester.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        userId: data.userId ?? null,
        allocation: requestedAllocation,
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
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.userId !== undefined ? { userId: data.userId } : {}),
        ...(data.allocation !== undefined ? { allocation: data.allocation } : {}),
      },
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
