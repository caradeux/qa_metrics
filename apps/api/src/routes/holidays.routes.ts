import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@qa-metrics/database";
import {
  authMiddleware,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const holidayBodySchema = z.object({
  date: dateSchema,
  name: z.string().min(1).max(200),
});

const holidayUpdateSchema = z.object({
  name: z.string().min(1).max(200),
});

// GET /api/holidays?year=YYYY — lista feriados de un año (lectura abierta a autenticados)
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

// POST /api/holidays — crear feriado
router.post(
  "/",
  requirePermission("holidays", "create") as any,
  async (req: AuthRequest, res: Response) => {
    const parsed = holidayBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos invalidos", details: parsed.error.flatten() });
      return;
    }
    const { date, name } = parsed.data;
    try {
      const created = await prisma.holiday.create({
        data: { date: new Date(date), name: name.trim() },
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.code === "P2002") {
        res.status(409).json({ error: "Ya existe un feriado en esa fecha" });
        return;
      }
      res.status(500).json({ error: "Error al crear feriado" });
    }
  },
);

// PUT /api/holidays/:date — renombrar feriado (fecha es inmutable al ser PK)
router.put(
  "/:date",
  requirePermission("holidays", "update") as any,
  async (req: AuthRequest, res: Response) => {
    const dateOk = dateSchema.safeParse(req.params.date);
    const bodyOk = holidayUpdateSchema.safeParse(req.body);
    if (!dateOk.success || !bodyOk.success) {
      res.status(400).json({ error: "Datos invalidos" });
      return;
    }
    try {
      const updated = await prisma.holiday.update({
        where: { date: new Date(dateOk.data) },
        data: { name: bodyOk.data.name.trim() },
      });
      res.json(updated);
    } catch (err: any) {
      if (err?.code === "P2025") {
        res.status(404).json({ error: "Feriado no encontrado" });
        return;
      }
      res.status(500).json({ error: "Error al actualizar feriado" });
    }
  },
);

// DELETE /api/holidays/:date
router.delete(
  "/:date",
  requirePermission("holidays", "delete") as any,
  async (req: AuthRequest, res: Response) => {
    const dateOk = dateSchema.safeParse(req.params.date);
    if (!dateOk.success) {
      res.status(400).json({ error: "Fecha invalida" });
      return;
    }
    try {
      await prisma.holiday.delete({ where: { date: new Date(dateOk.data) } });
      res.json({ message: "Feriado eliminado" });
    } catch (err: any) {
      if (err?.code === "P2025") {
        res.status(404).json({ error: "Feriado no encontrado" });
        return;
      }
      res.status(500).json({ error: "Error al eliminar feriado" });
    }
  },
);

// POST /api/holidays/bulk — crear/actualizar en lote (útil para cargar un año completo)
router.post(
  "/bulk",
  requirePermission("holidays", "create") as any,
  async (req: AuthRequest, res: Response) => {
    const schema = z.object({
      items: z.array(holidayBodySchema).min(1).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos invalidos", details: parsed.error.flatten() });
      return;
    }
    const rows = parsed.data.items;
    let created = 0;
    let updated = 0;
    for (const r of rows) {
      const result = await prisma.holiday.upsert({
        where: { date: new Date(r.date) },
        update: { name: r.name.trim() },
        create: { date: new Date(r.date), name: r.name.trim() },
      });
      // upsert no dice si creó o actualizó; chequear createdAt no aplica (no existe).
      // Para mantener el contador simple, lo contamos todos como "procesados".
      if (result) updated++;
    }
    res.json({ processed: updated, created: 0 });
  },
);

export default router;
