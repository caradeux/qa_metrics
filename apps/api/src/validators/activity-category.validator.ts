import { z } from "zod";

export const activityCategoryBandType = z.enum([
  "USER_MEETING",
  "DEV_MEETING",
  "TRAINING",
  "ABSENCE",
  "OTHER",
]);

export const createActivityCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  active: z.boolean().optional(),
  bandType: activityCategoryBandType.optional(),
});

export const updateActivityCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  active: z.boolean().optional(),
  bandType: activityCategoryBandType.optional(),
});
