import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import bcrypt from "bcryptjs";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { createUserSchema, updateUserSchema } from "../validators/user.validator.js";
import { ACTIVE_STATUSES } from "../lib/assignment-states.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET / — list all users (exclude password)
router.get("/", requirePermission("users", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const roleFilter = req.query.role as string | undefined;
    const minCapacity = req.query.minCapacity ? Number(req.query.minCapacity) : 0;
    const users = await prisma.user.findMany({
      where: roleFilter ? { role: { name: roleFilter } } : {},
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        allowOverallocation: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
        testers: {
          select: {
            allocation: true,
            assignments: {
              where: { status: { in: [...ACTIVE_STATUSES] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const withCapacity = users.map(u => {
      // Only count allocation for testers with at least one ACTIVE assignment
      const used = u.testers.reduce(
        (sum, t) => sum + (t.assignments.length > 0 ? t.allocation : 0),
        0
      );
      const available = u.allowOverallocation ? 100 : Math.max(0, 100 - used);
      const { testers, ...rest } = u;
      return { ...rest, allocationUsed: used, allocationAvailable: available };
    });
    const filtered = minCapacity > 0
      ? withCapacity.filter(u => u.allowOverallocation || u.allocationAvailable >= minCapacity)
      : withCapacity;
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// POST / — create user
router.post("/", requirePermission("users", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Validate role exists
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) {
      res.status(400).json({ error: "Rol no encontrado" });
      return;
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(409).json({ error: "Ya existe un usuario con ese email" });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        roleId: data.roleId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// PUT /:id — update user fields
router.put("/:id", requirePermission("users", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // Validate role if provided
    if (data.roleId) {
      const role = await prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        res.status(400).json({ error: "Rol no encontrado" });
        return;
      }
    }

    // Check email uniqueness if changing email
    if (data.email && data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
      if (emailTaken) {
        res.status(409).json({ error: "Ya existe un usuario con ese email" });
        return;
      }
    }

    // Hash password if provided
    const updateData: Record<string, any> = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    res.json(user);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// DELETE /:id — delete user (can't delete self)
router.delete("/:id", requirePermission("users", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (id === req.user!.id) {
      res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// PUT /:id/toggle-active — toggle active status
router.put("/:id/toggle-active", requirePermission("users", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (id === req.user!.id) {
      res.status(400).json({ error: "No puedes desactivarte a ti mismo" });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { active: !existing.active },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar estado del usuario" });
  }
});

export default router;
