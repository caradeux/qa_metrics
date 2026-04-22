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

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * QA_ANALYST no debe ver HUs cuya asignación actual está en PRODUCTION
 * y transicionó a ese estado antes de hoy (le damos el día de gracia).
 * Para otros roles devuelve la lista sin cambios.
 */
function hideOldProductionForAnalyst<T extends { id: string; currentAssignment: any }>(
  enriched: T[],
  storiesRaw: any[],
  roleName: string | undefined,
): T[] {
  if (roleName !== "QA_ANALYST") return enriched;
  const todayMs = startOfTodayMs();
  const rawById = new Map<string, any>(storiesRaw.map((s) => [s.id, s]));

  return enriched.filter((s) => {
    const curr = s.currentAssignment;
    if (!curr || curr.status !== "PRODUCTION") return true;
    const raw = rawById.get(s.id);
    const rawAssignment = raw?.assignments?.find((a: any) => a.id === curr.id);
    const lastLog = rawAssignment?.statusLogs?.[0];
    const changedAt = lastLog
      ? new Date(lastLog.changedAt).getTime()
      : new Date(rawAssignment?.updatedAt ?? 0).getTime();
    return changedAt >= todayMs;
  });
}

async function canAccessProject(req: AuthRequest, projectId: string): Promise<boolean> {
  if (isClientPm(req)) {
    const ids = await clientPmProjectIds(req.user!.id);
    return ids.includes(projectId);
  }
  // ADMIN / QA_LEAD: dueños del cliente. QA_ANALYST: tester vinculado al proyecto.
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { client: { userId: req.user!.id } },
        { testers: { some: { userId: req.user!.id } } },
      ],
    },
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
  const cycles = (story.cycles || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    assignments: (c.assignments || []).map((a: any) => {
      const lastLog = a.statusLogs?.[0];
      const d = daysSince(lastLog ? lastLog.changedAt : a.updatedAt);
      return {
        id: a.id,
        tester: a.tester,
        status: a.status,
        startDate: a.startDate,
        endDate: a.endDate,
        notes: a.notes,
        daysInStatus: d,
        phases: a.phases || [],
      };
    }),
  }));

  return {
    id: story.id,
    externalId: story.externalId,
    title: story.title,
    designComplexity: story.designComplexity,
    executionComplexity: story.executionComplexity,
    projectId: story.projectId,
    assignmentsCount: assignments.length,
    cycles,
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
  cycles: {
    orderBy: { name: "asc" as const },
    include: {
      assignments: {
        include: {
          tester: { select: { id: true, name: true } },
          statusLogs: { orderBy: { changedAt: "desc" as const }, take: 1 },
          phases: {
            select: { id: true, phase: true, startDate: true, endDate: true },
            orderBy: { startDate: "asc" as const },
          },
        },
      },
    },
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

      result = hideOldProductionForAnalyst(result, stories, req.user?.role?.name);

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
      const visible = hideOldProductionForAnalyst(enriched, stories, req.user?.role?.name);
      res.json({ projectId, stories: visible });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener historias del proyecto" });
    }
  }
);

export default router;
