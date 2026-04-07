import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
});

export const updateClientSchema = createClientSchema;
