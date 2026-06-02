import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createTestLineSchema, updateTestLineSchema } from "../validators/test-line.validator.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  const where: any = { id: projectId };
  if (isAnalyst(req)) where.testers = { some: { userId: req.user!.id } };
  else where.client = { userId: req.user!.id };
  const project = await prisma.project.findFirst({ where, select: { id: true } });
  return !!project;
}

// GET /?projectId=X — list test lines of a project
router.get("/", requirePermission("test-lines", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ error: "projectId es requerido" });
      return;
    }
    if (!(await userCanAccessProject(req, projectId))) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const lines = await prisma.testLine.findMany({
      where: { projectId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener líneas de prueba" });
  }
});

// POST / — create
router.post("/", requirePermission("test-lines", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createTestLineSchema.parse(req.body);
    if (!(await userCanAccessProject(req, data.projectId))) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const line = await prisma.testLine.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        externalId: data.externalId ?? null,
        ...(data.complexity ? { complexity: data.complexity } : {}),
      },
    });
    res.status(201).json(line);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al crear línea de prueba" });
  }
});

// PUT /:id — update
router.put("/:id", requirePermission("test-lines", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const data = updateTestLineSchema.parse(req.body);
    const existing = await prisma.testLine.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing || !(await userCanAccessProject(req, existing.projectId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    const line = await prisma.testLine.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.complexity !== undefined ? { complexity: data.complexity } : {}),
      },
    });
    res.json(line);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al actualizar línea de prueba" });
  }
});

// DELETE /:id — delete (cascade to assignments/records via Prisma onDelete)
router.delete("/:id", requirePermission("test-lines", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const existing = await prisma.testLine.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing || !(await userCanAccessProject(req, existing.projectId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    await prisma.testLine.delete({ where: { id } });
    res.json({ message: "Línea de prueba eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar línea de prueba" });
  }
});

export default router;
