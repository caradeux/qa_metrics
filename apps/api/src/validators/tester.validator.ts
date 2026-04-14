import { z } from "zod";

export const createTesterSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  projectId: z.string().min(1, "Proyecto requerido"),
  userId: z.string().min(1).optional().nullable(),
  allocation: z.number().int().min(1).max(100).optional(),
});

export const updateTesterSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200).optional(),
  userId: z.string().min(1).optional().nullable(),
  allocation: z.number().int().min(1).max(100).optional(),
});
