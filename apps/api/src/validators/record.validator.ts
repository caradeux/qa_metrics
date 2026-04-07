import { z } from "zod";

const nonNegInt = z.number().int().min(0);

export const weeklyRecordSchema = z.object({
  testerId: z.string().min(1),
  cycleId: z.string().min(1),
  weekStart: z.string().min(1),
  designedFunctional: nonNegInt,
  designedRegression: nonNegInt,
  designedSmoke: nonNegInt,
  designedExploratory: nonNegInt,
  executedFunctional: nonNegInt,
  executedRegression: nonNegInt,
  executedSmoke: nonNegInt,
  executedExploratory: nonNegInt,
  defectsCritical: nonNegInt,
  defectsHigh: nonNegInt,
  defectsMedium: nonNegInt,
  defectsLow: nonNegInt,
});

export const batchRecordSchema = z.object({
  records: z.array(weeklyRecordSchema).min(1),
});
