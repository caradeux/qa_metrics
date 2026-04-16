import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";
import { isAnalyst, analystProjectIds } from "../lib/access.js";

const router = Router();
router.use(authMiddleware as any);

/**
 * GET /api/date-change-logs
 * Query params:
 *   entityType?: CYCLE | ASSIGNMENT | PHASE
 *   entityId?:   string (cuid) — filtra por una entidad específica
 *   userId?:     string (cuid) — filtra por quién hizo el cambio
 *   dateFrom?:   ISO date (createdAt >= dateFrom)
 *   dateTo?:     ISO date (createdAt <= dateTo)
 *   limit?:      default 50, max 200
 *   offset?:     default 0
 *
 * Scope:
 *   ADMIN / QA_LEAD: ven todos los logs.
 *   QA_ANALYST: solo ven logs cuyos entityId pertenece a un proyecto asignado
 *               (ciclo de una HU de ese proyecto, asignación de un tester del proyecto,
 *               o fase de una asignación del proyecto) O logs que ellos mismos crearon.
 *   CLIENT_PM: bloqueado por requirePermission("audit","read").
 */
router.get(
  "/",
  requirePermission("audit", "read") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        entityType,
        entityId,
        userId,
        dateFrom,
        dateTo,
        limit: limitQ,
        offset: offsetQ,
      } = req.query as Record<string, string | undefined>;

      const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 200);
      const offset = Math.max(Number(offsetQ) || 0, 0);

      const where: Record<string, unknown> = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (userId) where.userId = userId;
      if (dateFrom || dateTo) {
        const range: Record<string, Date> = {};
        if (dateFrom) range.gte = new Date(dateFrom);
        if (dateTo) range.lte = new Date(dateTo);
        where.createdAt = range;
      }

      // Scope por rol
      const analyst = isAnalyst(req);
      let analystProjects: string[] = [];
      if (analyst) {
        analystProjects = await analystProjectIds(req.user!.id);
      }

      // Traer más del límite para filtrar por scope y recortar después
      const rawLogs = await prisma.dateChangeLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: analyst ? limit * 3 : limit,
        skip: offset,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Resolver descripciones de entidades en lotes
      const cycleIds = [...new Set(rawLogs.filter((l) => l.entityType === "CYCLE").map((l) => l.entityId))];
      const assignmentIds = [...new Set(rawLogs.filter((l) => l.entityType === "ASSIGNMENT").map((l) => l.entityId))];
      const phaseIds = [...new Set(rawLogs.filter((l) => l.entityType === "PHASE").map((l) => l.entityId))];

      const [cycles, assignments, phases] = await Promise.all([
        cycleIds.length > 0
          ? prisma.testCycle.findMany({
              where: { id: { in: cycleIds } },
              select: {
                id: true,
                name: true,
                story: { select: { title: true, projectId: true } },
              },
            })
          : Promise.resolve([]),
        assignmentIds.length > 0
          ? prisma.testerAssignment.findMany({
              where: { id: { in: assignmentIds } },
              select: {
                id: true,
                tester: { select: { name: true, projectId: true } },
                story: { select: { title: true } },
                cycle: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        phaseIds.length > 0
          ? prisma.assignmentPhase.findMany({
              where: { id: { in: phaseIds } },
              select: {
                id: true,
                phase: true,
                assignment: {
                  select: {
                    tester: { select: { name: true, projectId: true } },
                    story: { select: { title: true } },
                    cycle: { select: { name: true } },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

      const cycleById = new Map(cycles.map((c) => [c.id, c]));
      const assignmentById = new Map(assignments.map((a) => [a.id, a]));
      const phaseById = new Map(phases.map((p) => [p.id, p]));

      type Enriched = {
        id: string;
        entityType: string;
        entityId: string;
        field: string;
        oldValue: Date | null;
        newValue: Date | null;
        reason: string;
        createdAt: Date;
        user: { id: string; name: string; email: string };
        entityDescription: string;
        projectId: string | null;
      };

      const enriched: Enriched[] = rawLogs.map((log) => {
        let description = "(entidad eliminada)";
        let projectId: string | null = null;
        if (log.entityType === "CYCLE") {
          const c = cycleById.get(log.entityId);
          if (c) {
            description = `${c.name} — HU: ${c.story.title}`;
            projectId = c.story.projectId;
          }
        } else if (log.entityType === "ASSIGNMENT") {
          const a = assignmentById.get(log.entityId);
          if (a) {
            description = `${a.tester.name} · ${a.story.title} · ${a.cycle.name}`;
            projectId = a.tester.projectId;
          }
        } else if (log.entityType === "PHASE") {
          const p = phaseById.get(log.entityId);
          if (p) {
            description = `Fase ${p.phase} — ${p.assignment.tester.name} · ${p.assignment.story.title} · ${p.assignment.cycle.name}`;
            projectId = p.assignment.tester.projectId;
          }
        }
        return {
          id: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          field: log.field,
          oldValue: log.oldValue,
          newValue: log.newValue,
          reason: log.reason,
          createdAt: log.createdAt,
          user: log.user,
          entityDescription: description,
          projectId,
        };
      });

      // Filtrar por scope si es analista: mantener logs propios OR en proyectos asignados
      const scoped = analyst
        ? enriched.filter(
            (e) =>
              e.user.id === req.user!.id ||
              (e.projectId !== null && analystProjects.includes(e.projectId)),
          ).slice(0, limit)
        : enriched.slice(0, limit);

      res.json({
        items: scoped,
        count: scoped.length,
        limit,
        offset,
      });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener bitácora de cambios" });
    }
  },
);

export default router;
