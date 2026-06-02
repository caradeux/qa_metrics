import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import {
  createAutomationAssignmentSchema,
  updateAutomationAssignmentSchema,
} from "../validators/automation-assignment.validator.js";
import { isClientPm, isAnalyst, clientPmProjectIds } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

async function userCanAccessTestLine(req: AuthRequest, testLineId: string): Promise<boolean> {
  const line = await prisma.testLine.findUnique({ where: { id: testLineId }, select: { projectId: true } });
  if (!line) return false;
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(line.projectId);
  }
  const where: any = { id: line.projectId };
  if (isAnalyst(req)) where.testers = { some: { userId: req.user!.id } };
  else where.client = { userId: req.user!.id };
  const project = await prisma.project.findFirst({ where, select: { id: true } });
  return !!project;
}

// GET /?testLineId=X  OR  ?testerId=X
router.get("/", requirePermission("automation-assignments", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const testLineId = req.query.testLineId as string | undefined;
    const testerId = req.query.testerId as string | undefined;
    if (!testLineId && !testerId) {
      res.status(400).json({ error: "testLineId o testerId es requerido" });
      return;
    }
    if (testLineId && !(await userCanAccessTestLine(req, testLineId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    const list = await prisma.automationAssignment.findMany({
      where: {
        ...(testLineId ? { testLineId } : {}),
        ...(testerId ? { testerId } : {}),
      },
      include: {
        testLine: { select: { id: true, name: true } },
        tester: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener asignaciones de automatización" });
  }
});

// POST /
router.post("/", requirePermission("automation-assignments", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createAutomationAssignmentSchema.parse(req.body);
    if (!(await userCanAccessTestLine(req, data.testLineId))) {
      res.status(404).json({ error: "Línea de prueba no encontrada" });
      return;
    }
    const line = await prisma.testLine.findUnique({ where: { id: data.testLineId }, select: { projectId: true } });
    const tester = await prisma.tester.findUnique({ where: { id: data.testerId }, select: { projectId: true } });
    if (!tester || tester.projectId !== line!.projectId) {
      res.status(400).json({ error: "El tester no pertenece al proyecto de la línea de prueba" });
      return;
    }
    const created = await prisma.automationAssignment.create({
      data: {
        testerId: data.testerId,
        testLineId: data.testLineId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status ?? "ACTIVE",
        notes: data.notes ?? null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    if ((err as any)?.code === "P2002") { res.status(409).json({ error: "El tester ya está asignado a esta línea" }); return; }
    res.status(500).json({ error: "Error al crear asignación de automatización" });
  }
});

// PUT /:id
router.put("/:id", requirePermission("automation-assignments", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateAutomationAssignmentSchema.parse(req.body);
    const existing = await prisma.automationAssignment.findUnique({ where: { id }, select: { testLineId: true } });
    if (!existing || !(await userCanAccessTestLine(req, existing.testLineId))) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }
    const updated = await prisma.automationAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) { res.status(400).json({ error: "Datos invalidos", details: err.errors }); return; }
    res.status(500).json({ error: "Error al actualizar asignación de automatización" });
  }
});

// DELETE /:id
router.delete("/:id", requirePermission("automation-assignments", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const existing = await prisma.automationAssignment.findUnique({ where: { id }, select: { testLineId: true } });
    if (!existing || !(await userCanAccessTestLine(req, existing.testLineId))) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }
    await prisma.automationAssignment.delete({ where: { id } });
    res.json({ message: "Asignación eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar asignación de automatización" });
  }
});

export default router;
