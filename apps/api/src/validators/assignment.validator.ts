import { z } from "zod";

const STATUS_VALUES = [
  "REGISTERED",
  "ANALYSIS",
  "TEST_DESIGN",
  "EXECUTION",
  "RETURNED_TO_DEV",
  "WAITING_UAT",
  "UAT",
  "PRODUCTION",
] as const;

export const createAssignmentSchema = z.object({
  testerId: z.string().min(1),
  storyId: z.string().min(1),
  cycleId: z.string().min(1),
  startDate: z.string().min(1).optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().nullable().optional(),
});

export const updateAssignmentSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
