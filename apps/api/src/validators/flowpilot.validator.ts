import { z } from "zod";

export const upsertMappingSchema = z.object({
  userId: z.string().cuid(),
  kind: z.string().min(1).max(40),
  entityType: z.enum(["contract", "project"]),
  clientId: z.number().int(),
  clientName: z.string().min(1),
  contractId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  entityName: z.string().min(1),
  taskTypeId: z.number().int(),
  taskTypeName: z.string().min(1),
}).refine(
  (d) => (d.entityType === "contract" ? d.contractId != null : d.projectId != null),
  { message: "contract requiere contractId; project requiere projectId" },
);
