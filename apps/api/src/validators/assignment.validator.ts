import { z } from "zod";

export const createAssignmentSchema = z.object({
  testerId: z.string().min(1),
  storyId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  executionCycle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateAssignmentSchema = z.object({
  status: z
    .enum([
      "REGISTERED",
      "ANALYSIS",
      "TEST_DESIGN",
      "EXECUTION",
      "RETURNED_TO_DEV",
      "WAITING_UAT",
      "UAT",
      "PRODUCTION",
    ])
    .optional(),
  endDate: z.string().nullable().optional(),
  executionCycle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
