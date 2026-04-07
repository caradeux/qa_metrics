import { z } from "zod";

export const createCycleSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  projectId: z.string().min(1, "Proyecto requerido"),
  startDate: z.string().datetime().optional().or(z.string().optional()),
  endDate: z.string().datetime().optional().or(z.string().optional()),
});

export const updateCycleSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});
