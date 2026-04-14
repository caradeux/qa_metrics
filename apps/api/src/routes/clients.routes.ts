import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createClientSchema, updateClientSchema } from "../validators/client.validator.js";
import { isClientPm } from "../lib/access.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET / — list clients for authenticated user
router.get("/", requirePermission("clients", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const where = isClientPm(req)
      ? { projects: { some: { projectManagerId: req.user!.id } } }
      : { userId: req.user!.id };
    const clients = await prisma.client.findMany({
      where,
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// POST / — create client
router.post("/", requirePermission("clients", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const data = createClientSchema.parse(req.body);
    const client = await prisma.client.create({
      data: {
        name: data.name,
        userId: req.user!.id,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

// PUT /:id — update client
router.put("/:id", requirePermission("clients", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;
    const data = updateClientSchema.parse(req.body);

    const existing = await prisma.client.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }

    const client = await prisma.client.update({
      where: { id },
      data: { name: data.name },
    });
    res.json(client);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// DELETE /:id — delete client (409 if has projects)
router.delete("/:id", requirePermission("clients", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    if (isClientPm(req)) { res.status(403).json({ error: "Sin permiso" }); return; }
    const id = req.params.id as string;

    const existing = await prisma.client.findFirst({
      where: { id, userId: req.user!.id },
      include: { _count: { select: { projects: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    if (existing._count.projects > 0) {
      res.status(409).json({ error: "No se puede eliminar: el cliente tiene proyectos asociados" });
      return;
    }

    await prisma.client.delete({ where: { id } });
    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
