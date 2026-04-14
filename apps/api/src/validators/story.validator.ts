import { z } from "zod";

export const createStorySchema = z.object({
  projectId: z.string().min(1),
  externalId: z.string().optional().nullable(),
  title: z.string().min(1).max(500),
  designComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  executionComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const updateStorySchema = createStorySchema.partial();
