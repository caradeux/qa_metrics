import { z } from "zod";

const STATUS_VALUES = [
  "REGISTERED",
  "ANALYSIS",
  "TEST_DESIGN",
  "WAITING_QA_DEPLOY",
  "EXECUTION",
  "RETURNED_TO_DEV",
  "WAITING_UAT",
  "UAT",
  "PRODUCTION",
  "ON_HOLD",
] as const;

const phaseSchema = z.object({
  phase: z.enum(["ANALYSIS", "TEST_DESIGN", "EXECUTION"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createAssignmentSchema = z.object({
  testerId: z.string().min(1),
  storyId: z.string().min(1),
  cycleId: z.string().min(1),
  startDate: z.string().min(1).optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  notes: z.string().nullable().optional(),
  phases: z.array(phaseSchema).max(3).optional(),
});

export const updateAssignmentSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
