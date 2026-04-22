import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, requirePermission, invalidateAuthCache, type AuthRequest } from "../middleware/auth.js";
import { createRoleSchema, updateRoleSchema } from "../validators/role.validator.js";
import { ZodError } from "zod";

const router = Router();
router.use(authMiddleware as any);

// GET / — list roles with permissions and user count
router.get("/", requirePermission("roles", "read") as any, async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: { select: { resource: true, action: true } } },
        },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      permissions: role.permissions.map((rp: any) => rp.permission),
      _count: role._count,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener roles" });
  }
});

// POST / — create role with permissions
router.post("/", requirePermission("roles", "create") as any, async (req: AuthRequest, res: Response) => {
  try {
    const data = createRoleSchema.parse(req.body);

    // Check name uniqueness
    const existingRole = await prisma.role.findUnique({ where: { name: data.name } });
    if (existingRole) {
      res.status(409).json({ error: "Ya existe un rol con ese nombre" });
      return;
    }

    // Find or create permissions and connect them
    const role = await prisma.$transaction(async (tx: any) => {
      const newRole = await tx.role.create({
        data: {
          name: data.name,
          description: data.description,
        },
      });

      for (const perm of data.permissions) {
        const permission = await tx.permission.upsert({
          where: { resource_action: { resource: perm.resource, action: perm.action } },
          create: { resource: perm.resource, action: perm.action },
          update: {},
        });

        await tx.rolePermission.create({
          data: { roleId: newRole.id, permissionId: permission.id },
        });
      }

      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          permissions: {
            include: { permission: { select: { resource: true, action: true } } },
          },
          _count: { select: { users: true } },
        },
      });
    });

    if (role) {
      res.status(201).json({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        permissions: role.permissions.map((rp: any) => rp.permission),
        _count: role._count,
      });
    }
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al crear rol" });
  }
});

// PUT /:id — update role name/description + sync permissions
router.put("/:id", requirePermission("roles", "update") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateRoleSchema.parse(req.body);

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Rol no encontrado" });
      return;
    }
    // Check name uniqueness if changing
    if (data.name && data.name !== existing.name) {
      const nameTaken = await prisma.role.findUnique({ where: { name: data.name } });
      if (nameTaken) {
        res.status(409).json({ error: "Ya existe un rol con ese nombre" });
        return;
      }
    }

    const role = await prisma.$transaction(async (tx: any) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });

      // Sync permissions if provided
      if (data.permissions) {
        // Remove all existing permissions
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        // Add new permissions
        for (const perm of data.permissions) {
          const permission = await tx.permission.upsert({
            where: { resource_action: { resource: perm.resource, action: perm.action } },
            create: { resource: perm.resource, action: perm.action },
            update: {},
          });

          await tx.rolePermission.create({
            data: { roleId: id, permissionId: permission.id },
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: { permission: { select: { resource: true, action: true } } },
          },
          _count: { select: { users: true } },
        },
      });
    });

    if (role) {
      invalidateAuthCache();
      res.json({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        permissions: role.permissions.map((rp: any) => rp.permission),
        _count: role._count,
      });
    }
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos invalidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error al actualizar rol" });
  }
});

// DELETE /:id — delete role (block if isSystem or has users)
router.delete("/:id", requirePermission("roles", "delete") as any, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Rol no encontrado" });
      return;
    }
    if (existing.isSystem) {
      res.status(403).json({ error: "No se puede eliminar un rol de sistema" });
      return;
    }
    if ((existing as any)._count.users > 0) {
      res.status(409).json({ error: "No se puede eliminar: el rol tiene usuarios asignados" });
      return;
    }

    await prisma.role.delete({ where: { id } });
    invalidateAuthCache();
    res.json({ message: "Rol eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar rol" });
  }
});

export default router;
