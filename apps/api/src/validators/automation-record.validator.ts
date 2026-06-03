import { z } from "zod";

export const automationBulkSchema = z.object({
  testerId: z.string().cuid(),
  entries: z
    .array(
      z.object({
        assignmentId: z.string().cuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scriptsCreated: z.number().int().min(0),
        scriptsRefactored: z.number().int().min(0),
        scriptsFixed: z.number().int().min(0),
        execTotal: z.number().int().min(0),
        execPassed: z.number().int().min(0),
        execFailed: z.number().int().min(0),
        notes: z.string().max(2000).nullable().optional(),
      })
    )
    .min(1),
});
