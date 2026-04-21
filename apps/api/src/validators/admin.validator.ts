import { z } from "zod";

export const dailyLoadQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date debe ser YYYY-MM-DD")
    .optional(),
});

export type DailyLoadQuery = z.infer<typeof dailyLoadQuerySchema>;
