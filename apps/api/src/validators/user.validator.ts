import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(8, "Password debe tener al menos 8 caracteres"),
  name: z.string().min(1, "Nombre requerido").max(200),
  roleId: z.string().min(1, "Rol requerido"),
});

export const updateUserSchema = z.object({
  email: z.string().email("Email invalido").optional(),
  password: z.string().min(8, "Password debe tener al menos 8 caracteres").optional(),
  name: z.string().min(1).max(200).optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
