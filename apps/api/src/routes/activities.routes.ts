import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { ZodError } from "zod";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import {
  createActivitySchema,
  updateActivitySchema,
} from "../validators/activity.validator.js";
import { isClientPm, clientPmProjectIds } from "../lib/access.js";

const router = Router();
router.use(authMiddleware as any);

async function canManageTester(req: AuthRequest, testerId: string): Promise<boolean> {
  const role = req.user!.role.name;
  if (role === "ADMIN" || role === "QA_LEAD") return true;
  if (role === "CLIENT_PM") return false;
  // QA_ANALYST: solo sobre sus propios testers (Tester.userId === req.user.id)
  const tester = await prisma.tester.findFirst({
    where: { id: testerId, userId: req.user!.id },
    select: { id: true },
  });
  return !!tester;
}

async function hasOverlap(
  testerId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<boolean> {
  const overlapping = await prisma.activity.findFirst({
    where: {
      testerId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!overlapping;
}

// GET /api/activities?testerId&projectId&assignmentId&from&to
router.get("/", requirePermission("activities", "read"), async (req: AuthRequest, res: Response) => {
  const { testerId, projectId, assignmentId, from, to } = req.query as Record<string, string | undefined>;

  const where: any = {};
  if (testerId) where.testerId = testerId;
  if (assignmentId) where.assignmentId = assignmentId;
  if (projectId) where.tester = { projectId };
  if (from) where.endAt = { gt: new Date(from) };
  if (to) where.startAt = { lt: new Date(to) };

  // Scope filtering por rol.
  const role = req.user!.role.name;
  if (role === "QA_ANALYST") {
    where.tester = { ...(where.tester || {}), userId: req.user!.id };
  } else if (role === "CLIENT_PM") {
    const ids = await clientPmProjectIds(req.user!.id);
    where.tester = { ...(where.tester || {}), projectId: { in: ids } };
  }

  const activities = await prisma.activity.findMany({
    where,
    include: {
      category: true,
      assignment: { include: { story: { select: { id: true, title: true } } } },
      tester: { select: { id: true, name: true, projectId: true } },
    },
    orderBy: { startAt: "asc" },
  });
  res.json(activities);
});

router.post("/", requirePermission("activities", "create"), async (req: AuthRequest, res: Response) => {
  try {
    const data = createActivitySchema.parse(req.body);

    if (!(await canManageTester(req, data.testerId))) {
      return res.status(403).json({ error: "Sin permiso para crear actividades de este tester" });
    }

    if (data.assignmentId) {
      const asg = await prisma.testerAssignment.findUnique({
        where: { id: data.assignmentId },
        select: { testerId: true },
      });
      if (!asg) return res.status(400).json({ error: "Asignación no existe" });
      if (asg.testerId !== data.testerId) {
        return res.status(400).json({ error: "La asignación no pertenece al tester" });
      }
    }

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (await hasOverlap(data.testerId, startAt, endAt)) {
      return res.status(409).json({ error: "Solape con otra actividad del mismo tester" });
    }

    const created = await prisma.activity.create({
      data: {
        testerId: data.testerId,
        categoryId: data.categoryId,
        assignmentId: data.assignmentId ?? null,
        startAt, endAt,
        notes: data.notes ?? null,
        createdById: req.user!.id,
      },
      include: { category: true },
    });
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    throw e;
  }
});

router.patch("/:id", requirePermission("activities", "update"), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.activity.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: "No encontrada" });

    if (!(await canManageTester(req, existing.testerId))) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const data = updateActivitySchema.parse(req.body);
    const startAt = data.startAt ? new Date(data.startAt) : existing.startAt;
    const endAt = data.endAt ? new Date(data.endAt) : existing.endAt;

    if (startAt >= endAt) {
      return res.status(400).json({ error: "startAt debe ser anterior a endAt" });
    }
    if (await hasOverlap(existing.testerId, startAt, endAt, existing.id)) {
      return res.status(409).json({ error: "Solape con otra actividad" });
    }

    const updated = await prisma.activity.update({
      where: { id: existing.id },
      data: {
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.assignmentId !== undefined ? { assignmentId: data.assignmentId } : {}),
        startAt, endAt,
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { category: true },
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    throw e;
  }
});

router.delete("/:id", requirePermission("activities", "delete"), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.activity.findUnique({ where: { id: req.params.id as string } });
  if (!existing) return res.status(404).json({ error: "No encontrada" });
  if (!(await canManageTester(req, existing.testerId))) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  await prisma.activity.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
