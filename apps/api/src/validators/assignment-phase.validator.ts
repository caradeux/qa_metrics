import { z } from "zod";

export const phaseInputSchema = z.object({
  phase: z.enum(["ANALYSIS", "TEST_DESIGN", "EXECUTION"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PhaseInput = z.infer<typeof phaseInputSchema>;

export const phasesArraySchema = z.array(phaseInputSchema).max(3);

export const updatePhasesSchema = z.object({
  phases: phasesArraySchema,
  reason: z.string().optional(),
});
