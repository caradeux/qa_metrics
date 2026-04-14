import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  clientId: z.string().min(1, "Cliente requerido"),
  modality: z.enum(["MANUAL", "AZURE_DEVOPS"]),
  adoOrgUrl: z.string().optional(),
  adoProject: z.string().optional(),
  adoToken: z.string().optional(),
  projectManagerId: z.string().nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  name: z.string().min(1, "Nombre requerido"),
});
