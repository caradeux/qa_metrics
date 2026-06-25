import { z } from "zod";

export const createTesterSchema = z.object({
  // El nombre se deriva del analista en el backend; ya no se crea por texto libre.
  name: z.string().min(1).max(200).optional(),
  projectId: z.string().min(1, "Proyecto requerido"),
  userId: z.string().min(1, "Debe seleccionar un analista del sistema"),
  allocation: z.number().int().min(1).max(100).optional(),
});

export const updateTesterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  // No se permite desvincular a null: un tester es siempre un analista del sistema.
  userId: z.string().min(1).optional(),
  allocation: z.number().int().min(1).max(100).optional(),
});
