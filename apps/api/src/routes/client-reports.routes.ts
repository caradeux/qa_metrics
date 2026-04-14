import { Router, Response } from "express";
import { z } from "zod";
import { addMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware as any);

function isLeader(req: AuthRequest) {
  const r = req.user?.role?.name;
  return r === "ADMIN" || r === "QA_LEAD";
}

router.get("/client/:id/monthly", async (req: AuthRequest, res: Response) => {
  if (!isLeader(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const parse = z
    .object({ months: z.coerce.number().int().min(1).max(24).default(6) })
    .safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const monthsCount = parse.data.months;

  const clientIdParam = req.params.id as string;
  const client = await prisma.client.findUnique({
    where: { id: clientIdParam },
    include: {
      projects: {
        include: {
          testers: { select: { id: true, name: true, projectId: true } },
        },
      },
    },
  });
  if (!client) {
    res.status(404).json({ error: "client not found" });
    return;
  }

  const today = new Date();
  const buckets: { start: Date; end: Date; label: string; key: string }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const ref = addMonths(today, -i);
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    buckets.push({
      start,
      end,
      label: format(start, "LLLL", { locale: es }).replace(/^./, (c) =>
        c.toUpperCase()
      ),
      key: format(start, "yyyy-MM"),
    });
  }

  const projectIds = client.projects.map((p) => p.id);
  const testerIds = client.projects.flatMap((p) => p.testers.map((t) => t.id));

  const records =
    testerIds.length > 0
      ? await prisma.dailyRecord.findMany({
          where: {
            testerId: { in: testerIds },
            date: {
              gte: buckets[0]!.start,
              lte: buckets[buckets.length - 1]!.end,
            },
          },
          select: {
            date: true,
            designed: true,
            executed: true,
            defects: true,
            testerId: true,
          },
        })
      : [];

  const testerProject = new Map<string, string>();
  for (const p of client.projects)
    for (const t of p.testers) testerProject.set(t.id, p.id);

  type Agg = {
    designed: number;
    executed: number;
    defects: number;
    testers: Set<string>;
  };
  const makeAgg = (): Agg => ({
    designed: 0,
    executed: 0,
    defects: 0,
    testers: new Set(),
  });

  const totalByMonth: Record<string, Agg> = Object.fromEntries(
    buckets.map((b) => [b.key, makeAgg()])
  );
  const byProjectMonth: Record<string, Record<string, Agg>> =
    Object.fromEntries(
      projectIds.map((pid) => [
        pid,
        Object.fromEntries(buckets.map((b) => [b.key, makeAgg()])),
      ])
    );

  for (const r of records) {
    const monthKey = format(r.date, "yyyy-MM");
    if (!totalByMonth[monthKey]) continue;
    const pid = testerProject.get(r.testerId);
    if (!pid) continue;
    totalByMonth[monthKey]!.designed += r.designed;
    totalByMonth[monthKey]!.executed += r.executed;
    totalByMonth[monthKey]!.defects += r.defects;
    totalByMonth[monthKey]!.testers.add(r.testerId);
    byProjectMonth[pid]![monthKey]!.designed += r.designed;
    byProjectMonth[pid]![monthKey]!.executed += r.executed;
    byProjectMonth[pid]![monthKey]!.defects += r.defects;
    byProjectMonth[pid]![monthKey]!.testers.add(r.testerId);
  }

  const months = buckets.map((b) => b.label);
  const totalValues = (field: "designed" | "executed" | "defects") =>
    buckets.map((b) => totalByMonth[b.key]![field]);

  const avgValues = (field: "designed" | "executed") =>
    buckets.map((b) => {
      const a = totalByMonth[b.key]!;
      return a.testers.size > 0 ? Math.round(a[field] / a.testers.size) : 0;
    });

  const byProjectSeries = (field: "designed" | "executed" | "defects") =>
    client.projects.map((p) => ({
      project: p.name,
      values: buckets.map((b) => byProjectMonth[p.id]![b.key]![field]),
    }));

  res.json({
    client: { id: client.id, name: client.name },
    months,
    designedTotal: { months, values: totalValues("designed") },
    designedByProject: byProjectSeries("designed"),
    designedAverage: { months, values: avgValues("designed") },
    executedTotal: { months, values: totalValues("executed") },
    executedByProject: byProjectSeries("executed"),
    executedAverage: { months, values: avgValues("executed") },
    defectsTotal: { months, values: totalValues("defects") },
    defectsByProject: byProjectSeries("defects"),
    analysts: client.projects.map((p) => ({
      project: p.name,
      testers: p.testers.map((t) => t.name),
    })),
  });
});

export default router;
