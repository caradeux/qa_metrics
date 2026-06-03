import { z } from "zod";

const STATUS_VALUES = ["ACTIVE", "MAINTENANCE", "PAUSED", "DONE"] as const;

export const createAutomationAssignmentSchema = z.object({
  testerId: z.string().min(1),
  testLineId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().nullable().optional(),
});

export const updateAutomationAssignmentSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
