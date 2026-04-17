import { z } from "zod";

const isoDateTime = z.string().datetime({ offset: true });

export const createActivitySchema = z.object({
  testerId: z.string().min(1),
  categoryId: z.string().min(1),
  assignmentId: z.string().min(1).nullable().optional(),
  startAt: isoDateTime,
  endAt: isoDateTime,
  notes: z.string().max(2000).nullable().optional(),
}).refine((d) => new Date(d.startAt) < new Date(d.endAt), {
  message: "startAt debe ser anterior a endAt",
  path: ["endAt"],
}).refine((d) => {
  const durationH = (new Date(d.endAt).getTime() - new Date(d.startAt).getTime()) / 3600000;
  return durationH <= 24;
}, { message: "La duración máxima por evento es 24 horas", path: ["endAt"] });

export const updateActivitySchema = z.object({
  categoryId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).nullable().optional(),
  startAt: isoDateTime.optional(),
  endAt: isoDateTime.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
