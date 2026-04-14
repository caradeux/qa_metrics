import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import {
  createStorySchema,
  updateStorySchema,
} from "../validators/story.validator.js";
import { ZodError } from "zod";
import { isClientPm, clientPmProjectIds } from "../lib/access.js";

const router = Router();
router.use(authMiddleware as any);

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

async function canAccessProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { userId: req.user!.id } },
    select: { id: true },
  });
  return !!project;
}

// Helper: builds story response with currentAssignment
async function enrichStory(story: any) {
  // currentAssignment: most recent by createdAt
  const assignments = story.assignments || [];
  assignments.sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const current = assignments[0] || null;
  let daysInStatus: number | null = null;
  if (current) {
    const lastLog = current.statusLogs?.[0];
    daysInStatus = daysSince(lastLog ? lastLog.changedAt : current.updatedAt);
  }
  return {
    id: story.id,
    externalId: story.externalId,
    title: story.title,
    designComplexity: story.designComplexity,
    executionComplexity: story.executionComplexity,
    projectId: story.projectId,
    assignmentsCount: assignments.length,
    currentAssignment: current
      ? {
          id: current.id,
          cycleId: current.cycleId,
          cycle: current.cycle,
          tester: current.tester,
          status: current.status,
          startDate: current.startDate,
          endDate: current.endDate,
          notes: current.notes,
          daysInStatus,
        }
      : null,
  };
}

const storyInclude = {
  assignments: {
    include: {
      cycle: { select: { id: true, name: true, startDate: true, endDate: true } },
      tester: { select: { id: true, name: true } },
      statusLogs: {
        orderBy: { changedAt: "desc" as const },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

// GET /api/stories?projectId=X&cycleId=Y&status=Z&testerId=W
router.get(
  "/stories",
  requirePermission("stories", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, cycleId, status, testerId } = req.query as Record<string, string>;

      const where: any = {};
      if (projectId) {
        if (!(await canAccessProject(req, projectId))) {
          res.status(403).json({ error: "Sin acceso" });
          return;
        }
        where.projectId = projectId;
      } else if (isClientPm(req)) {
        const ids = await clientPmProjectIds(req.user!.id);
        where.projectId = { in: ids };
      } else {
        where.project = { client: { userId: req.user!.id } };
      }

      const stories = await prisma.userStory.findMany({
        where,
        include: storyInclude,
        orderBy: { title: "asc" },
      });

      let result = await Promise.all(stories.map(enrichStory));

      if (cycleId) result = result.filter((s) => s.currentAssignment?.cycleId === cycleId);
      if (status) result = result.filter((s) => s.currentAssignment?.status === status);
      if (testerId) result = result.filter((s) => s.currentAssignment?.tester?.id === testerId);

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al obtener historias" });
    }
  }
);

// GET /api/stories/:id
router.get(
  "/stories/:id",
  requirePermission("stories", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const story = await prisma.userStory.findUnique({
        where: { id },
        include: storyInclude,
      });
      if (!story) {
        res.status(404).json({ error: "Historia no encontrada" });
        return;
      }
      if (!(await canAccessProject(req, story.projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }
      res.json(await enrichStory(story));
    } catch {
      res.status(500).json({ error: "Error al obtener historia" });
    }
  }
);

// POST /api/stories
router.post(
  "/stories",
  requirePermission("stories", "create") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      if (isClientPm(req)) {
        res.status(403).json({ error: "Sin permiso" });
        return;
      }
      const data = createStorySchema.parse(req.body);
      if (!(await canAccessProject(req, data.projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }
      const story = await prisma.userStory.create({
        data: {
          projectId: data.projectId,
          externalId: data.externalId ?? null,
          title: data.title,
          designComplexity: data.designComplexity ?? "MEDIUM",
          executionComplexity: data.executionComplexity ?? "MEDIUM",
        },
      });
      res.status(201).json(story);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      res.status(500).json({ error: "Error al crear historia" });
    }
  }
);

// PUT /api/stories/:id
router.put(
  "/stories/:id",
  requirePermission("stories", "update") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      if (isClientPm(req)) {
        res.status(403).json({ error: "Sin permiso" });
        return;
      }
      const id = req.params.id as string;
      const data = updateStorySchema.parse(req.body);

      const existing = await prisma.userStory.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Historia no encontrada" });
        return;
      }
      if (!(await canAccessProject(req, existing.projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }

      const story = await prisma.userStory.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
          ...(data.designComplexity !== undefined ? { designComplexity: data.designComplexity } : {}),
          ...(data.executionComplexity !== undefined ? { executionComplexity: data.executionComplexity } : {}),
        },
      });
      res.json(story);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Datos invalidos", details: err.errors });
        return;
      }
      res.status(500).json({ error: "Error al actualizar historia" });
    }
  }
);

// DELETE /api/stories/:id
router.delete(
  "/stories/:id",
  requirePermission("stories", "delete") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      if (isClientPm(req)) {
        res.status(403).json({ error: "Sin permiso" });
        return;
      }
      const id = req.params.id as string;
      const existing = await prisma.userStory.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Historia no encontrada" });
        return;
      }
      if (!(await canAccessProject(req, existing.projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }
      await prisma.userStory.delete({ where: { id } });
      res.json({ message: "Historia eliminada" });
    } catch {
      res.status(500).json({ error: "Error al eliminar historia" });
    }
  }
);

// GET /api/projects/:id/stories — grouped by cycle
router.get(
  "/projects/:id/stories",
  requirePermission("stories", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      if (!(await canAccessProject(req, projectId))) {
        res.status(403).json({ error: "Sin acceso" });
        return;
      }

      const stories = await prisma.userStory.findMany({
        where: { projectId },
        include: storyInclude,
        orderBy: { title: "asc" },
      });

      const enriched = await Promise.all(stories.map(enrichStory));

      const cycles = await prisma.testCycle.findMany({
        where: { projectId },
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, startDate: true, endDate: true },
      });

      const byCycleMap = new Map<string | null, { cycle: any; stories: any[] }>();
      for (const c of cycles) byCycleMap.set(c.id, { cycle: c, stories: [] });
      byCycleMap.set(null, { cycle: null, stories: [] });

      for (const s of enriched) {
        const cid = s.currentAssignment?.cycleId ?? null;
        if (!byCycleMap.has(cid)) byCycleMap.set(cid, { cycle: s.currentAssignment?.cycle ?? null, stories: [] });
        byCycleMap.get(cid)!.stories.push(s);
      }

      const byCycle = Array.from(byCycleMap.values()).filter(
        (g) => g.cycle !== null || g.stories.length > 0
      );

      res.json({ projectId, byCycle });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener historias del proyecto" });
    }
  }
);

export default router;
