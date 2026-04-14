import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

const fields = [
  "designedFunctional",
  "designedRegression",
  "designedSmoke",
  "designedExploratory",
  "executedFunctional",
  "executedRegression",
  "executedSmoke",
  "executedExploratory",
  "defectsCritical",
  "defectsHigh",
  "defectsMedium",
  "defectsLow",
] as const;
const shape: Record<string, z.ZodTypeAny> = {};
for (const f of fields) shape[f] = z.number().int().min(0).optional();
const breakdownSchema = z.object(shape);

function isLeader(req: AuthRequest): boolean {
  const r = req.user?.role?.name;
  return r === "ADMIN" || r === "QA_LEAD";
}

router.get(
  "/cycles/:id/breakdown",
  async (req: AuthRequest, res: Response) => {
    const bd = await prisma.cycleBreakdown.findUnique({
      where: { cycleId: req.params.id as string },
    });
    if (!bd) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(bd);
  }
);

router.put(
  "/cycles/:id/breakdown",
  async (req: AuthRequest, res: Response) => {
    if (!isLeader(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const parsed = breakdownSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const bd = await prisma.cycleBreakdown.upsert({
      where: { cycleId: req.params.id as string },
      create: { cycleId: req.params.id as string, ...parsed.data },
      update: parsed.data,
    });
    res.json(bd);
  }
);

export default router;
