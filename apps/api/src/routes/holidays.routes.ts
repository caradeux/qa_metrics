import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

router.get("/", async (req: AuthRequest, res: Response) => {
  const parsed = z
    .object({ year: z.coerce.number().int().min(2020).max(2100) })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { year } = parsed.data;
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    orderBy: { date: "asc" },
  });
  res.json(holidays);
});

export default router;
