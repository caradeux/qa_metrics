import { z } from "zod";

export const createTesterSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  projectId: z.string().min(1, "Proyecto requerido"),
});

export const updateTesterSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
});
