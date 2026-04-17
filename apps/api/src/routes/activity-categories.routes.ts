import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { ZodError } from "zod";
import { authMiddleware, requirePermission, type AuthRequest } from "../middleware/auth.js";
import {
  createActivityCategorySchema,
  updateActivityCategorySchema,
} from "../validators/activity-category.validator.js";

const router = Router();
router.use(authMiddleware as any);

router.get("/", requirePermission("activity-categories", "read"), async (req: AuthRequest, res: Response) => {
  const activeOnly = req.query.activeOnly === "true";
  const where = activeOnly ? { active: true } : {};
  const categories = await prisma.activityCategory.findMany({
    where,
    orderBy: { name: "asc" },
  });
  res.json(categories);
});

router.post("/", requirePermission("activity-categories", "create"), async (req: AuthRequest, res: Response) => {
  try {
    const data = createActivityCategorySchema.parse(req.body);
    const created = await prisma.activityCategory.create({ data });
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    if ((e as any).code === "P2002") return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    throw e;
  }
});

router.patch("/:id", requirePermission("activity-categories", "update"), async (req: AuthRequest, res: Response) => {
  try {
    const data = updateActivityCategorySchema.parse(req.body);
    const updated = await prisma.activityCategory.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    if ((e as any).code === "P2025") return res.status(404).json({ error: "No encontrada" });
    if ((e as any).code === "P2002") return res.status(409).json({ error: "Nombre duplicado" });
    throw e;
  }
});

router.delete("/:id", requirePermission("activity-categories", "delete"), async (req: AuthRequest, res: Response) => {
  const inUse = await prisma.activity.count({ where: { categoryId: req.params.id } });
  if (inUse > 0) {
    return res.status(409).json({
      error: "La categoría tiene actividades asociadas. Desactívala en vez de eliminarla.",
    });
  }
  try {
    await prisma.activityCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    if ((e as any).code === "P2025") return res.status(404).json({ error: "No encontrada" });
    throw e;
  }
});

export default router;
