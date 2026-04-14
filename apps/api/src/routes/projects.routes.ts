import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { encrypt } from "@qa-metrics/utils";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.validator.js";
import { isClientPm } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET / — list projects, optional ?clientId filter. Never return adoToken
router.get("/", requirePermission("projects", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const clientPm = isClientPm(req);

    const where: any = {
      ...(clientId ? { clientId } : {}),
    };
    if (clientPm) {
      where.projectManagerId = req.user!.id;
    } else {
      where.client = { userId: req.user!.id };
    }

    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        clientId: true,
        modality: true,
        adoOrgUrl: true,
        adoProject: true,
        projectManagerId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        projectManager: { select: { id: true, name: true, email: true } },
        testers: { select: { id: true, name: true, allocation: true }, orderBy: { name: "asc" } },
        _count: { select: { cycles: true, testers: true, stories: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener proyectos" });
  }
});

// GET /:id — get single project
router.get("/:id", requirePermission("projects", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const clientPm = isClientPm(req);
    const where: any = { id };
    if (clientPm) {
      where.projectManagerId = req.user!.id;
    } else {
      where.client = { userId: req.user!.id };
    }
    const project = await prisma.project.findFirst({
      where,
      select: {
        id: true, name: true, clientId: true, modality: true,
        adoOrgUrl: true, adoProject: true, projectManagerId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        projectManager: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener proyecto" });
  }
});

// POST / — create project
router.post("/", requirePermission("projects", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) {
      res.status(403).json({ error: "Sin permiso" });
      return;
    }
    const data = createProjectSchema.parse(req.body);

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: req.user!.id },
    });
    if (!client) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }

    // Verify projectManager is a CLIENT_PM user if provided
    if (data.projectManagerId) {
      const pm = await prisma.user.findFirst({
        where: { id: data.projectManagerId, role: { name: "CLIENT_PM" } },
      });
      if (!pm) {
        res.status(400).json({ error: "Jefe de Proyecto invalido" });
        return;
      }
    }

    // Encrypt adoToken if AZURE_DEVOPS modality
    let adoToken = data.adoToken;
    if (data.modality === "AZURE_DEVOPS" && adoToken) {
      adoToken = encrypt(adoToken);
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        clientId: data.clientId,
        modality: data.modality,
        adoOrgUrl: data.adoOrgUrl,
        adoProject: data.adoProject,
        adoToken,
        projectManagerId: data.projectManagerId ?? null,
      },
    });

    // Return without adoToken
    const { adoToken: _, ...safeProject } = project;
    res.status(201).json(safeProject);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear proyecto" });
  }
});

// PUT /:id — update project. Block modality change if has records (409)
router.put("/:id", requirePermission("projects", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) {
      res.status(403).json({ error: "Sin permiso" });
      return;
    }
    const id = req.params.id as string;
    const data = updateProjectSchema.parse(req.body);

    const existing = await prisma.project.findFirst({
      where: { id, client: { userId: req.user!.id } },
      include: {
        cycles: { include: { _count: { select: { records: true } } } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    // Block modality change if project has records
    if (data.modality && data.modality !== existing.modality) {
      const hasRecords = existing.cycles.some((c: any) => c._count.records > 0);
      if (hasRecords) {
        res.status(409).json({ error: "No se puede cambiar la modalidad: el proyecto tiene registros" });
        return;
      }
    }

    if (data.projectManagerId) {
      const pm = await prisma.user.findFirst({
        where: { id: data.projectManagerId, role: { name: "CLIENT_PM" } },
      });
      if (!pm) {
        res.status(400).json({ error: "Jefe de Proyecto invalido" });
        return;
      }
    }

    // Encrypt adoToken if provided
    let adoToken = data.adoToken;
    const effectiveModality = data.modality || existing.modality;
    if (effectiveModality === "AZURE_DEVOPS" && adoToken) {
      adoToken = encrypt(adoToken);
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        clientId: data.clientId,
        modality: data.modality,
        adoOrgUrl: data.adoOrgUrl,
        adoProject: data.adoProject,
        ...(adoToken !== undefined ? { adoToken } : {}),
        ...(data.projectManagerId !== undefined ? { projectManagerId: data.projectManagerId } : {}),
      },
    });

    const { adoToken: _, ...safeProject } = project;
    res.json(safeProject);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar proyecto" });
  }
});

// DELETE /:id — delete project (cascade configured in Prisma)
router.delete("/:id", requirePermission("projects", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) {
      res.status(403).json({ error: "Sin permiso" });
      return;
    }
    const id = req.params.id as string;

    const existing = await prisma.project.findFirst({
      where: { id, client: { userId: req.user!.id } },
    });
    if (!existing) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    await prisma.project.delete({ where: { id } });
    res.json({ message: "Proyecto eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar proyecto" });
  }
});

export default router;
