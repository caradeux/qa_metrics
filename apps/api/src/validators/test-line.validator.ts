import { z } from "zod";

export const createTestLineSchema = z.object({
  projectId: z.string().min(1),
  externalId: z.string().optional().nullable(),
  name: z.string().min(1).max(300),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const updateTestLineSchema = createTestLineSchema.partial();
