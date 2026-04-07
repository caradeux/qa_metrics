import { z } from "zod";

const permissionSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
});

export const createRoleSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).min(1, "Al menos un permiso requerido"),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).optional(),
});
