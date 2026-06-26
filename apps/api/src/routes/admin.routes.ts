import { Router, Response } from "express";
import { prisma } from "@qa-metrics/database";
import { ZodError } from "zod";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { dailyLoadQuerySchema } from "../validators/admin.validator.js";
import { toUtcDateOnly } from "../lib/workdays.js";
import { ACTIVE_STATUSES, type AssignmentStatus } from "../lib/assignment-states.js";
import { findTestersWithMissingRecords, resolveCcRecipients } from "../lib/daily-alerts.js";
import { sendMail } from "../lib/mailer.js";
import { renderDailyAlert } from "../templates/daily-alert.js";

const router = Router();
router.use(authMiddleware as any);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role?.name !== "ADMIN") {
    res.status(403).json({ error: "Solo ADMIN" });
    return false;
  }
  return true;
}

// GET /api/admin/daily-load?date=YYYY-MM-DD
router.get("/daily-load", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    dailyLoadQuerySchema.parse(req.query);
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ errors: e.errors });
    throw e;
  }

  const dateStr = (req.query.date as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  const dayUtc = toUtcDateOnly(dateStr);
  const nextDayUtc = new Date(dayUtc);
  nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);

  const dow = dayUtc.getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  const holiday = await prisma.holiday.findUnique({ where: { date: dayUtc } });
  const isNonBusinessDay = isWeekend || !!holiday;

  // Analistas activos con al menos un Tester vinculado (testers.some).
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: { name: "QA_ANALYST" },
      testers: { some: {} },
    },
    select: {
      id: true,
      email: true,
      name: true,
      testers: {
        select: {
          id: true,
          project: { select: { client: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const testerIds = users.flatMap((u) => u.testers.map((t) => t.id));
  const userByTesterId = new Map<string, string>();
  for (const u of users) for (const t of u.testers) userByTesterId.set(t.id, u.id);

  const dailyRecords = testerIds.length
    ? await prisma.dailyRecord.findMany({
        where: { testerId: { in: testerIds }, date: dayUtc },
        select: {
          testerId: true,
          assignmentId: true,
          designed: true,
          executed: true,
          defects: true,
          updatedAt: true,
          createdAt: true,
          assignment: {
            select: {
              id: true,
              story: {
                select: {
                  id: true,
                  title: true,
                  externalId: true,
                  project: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })
    : [];

  type DailyEntry = {
    projectId: string;
    projectName: string;
    storyId: string;
    storyTitle: string;
    storyExternalId: string | null;
    designed: number;
    executed: number;
    defects: number;
  };
  type DailyAgg = {
    loaded: boolean;
    storiesCount: number;
    designed: number;
    executed: number;
    defects: number;
    lastAt: Date | null;
    entriesByAssignment: Map<string, DailyEntry>;
  };
  const dailyByUser = new Map<string, DailyAgg>();
  for (const r of dailyRecords) {
    const userId = userByTesterId.get(r.testerId);
    if (!userId) continue;
    let agg = dailyByUser.get(userId);
    if (!agg) {
      agg = {
        loaded: true, storiesCount: 0,
        designed: 0, executed: 0, defects: 0,
        lastAt: null,
        entriesByAssignment: new Map(),
      };
      dailyByUser.set(userId, agg);
    }
    agg.designed += r.designed;
    agg.executed += r.executed;
    agg.defects += r.defects;
    const at = r.updatedAt ?? r.createdAt;
    if (!agg.lastAt || at > agg.lastAt) agg.lastAt = at;

    const story = r.assignment.story;
    const project = story.project;
    let entry = agg.entriesByAssignment.get(r.assignmentId);
    if (!entry) {
      entry = {
        projectId: project.id,
        projectName: project.name,
        storyId: story.id,
        storyTitle: story.title,
        storyExternalId: story.externalId ?? null,
        designed: 0, executed: 0, defects: 0,
      };
      agg.entriesByAssignment.set(r.assignmentId, entry);
    }
    entry.designed += r.designed;
    entry.executed += r.executed;
    entry.defects += r.defects;
  }
  for (const agg of dailyByUser.values()) {
    agg.storiesCount = agg.entriesByAssignment.size;
  }

  const activities = testerIds.length
    ? await prisma.activity.findMany({
        where: {
          testerId: { in: testerIds },
          startAt: { gte: dayUtc, lt: nextDayUtc },
        },
        select: {
          testerId: true,
          startAt: true,
          endAt: true,
          createdAt: true,
          category: { select: { name: true } },
          assignment: {
            select: {
              story: {
                select: {
                  title: true,
                  externalId: true,
                  project: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })
    : [];

  type ActEntry = {
    categoryName: string;
    hours: number;
    projectName: string | null;
    storyTitle: string | null;
    storyExternalId: string | null;
  };
  type ActAgg = { hours: number; lastAt: Date | null; entries: ActEntry[] };
  const actByUser = new Map<string, ActAgg>();
  for (const a of activities) {
    const userId = userByTesterId.get(a.testerId);
    if (!userId) continue;
    const hours = (a.endAt.getTime() - a.startAt.getTime()) / 3_600_000;
    let agg = actByUser.get(userId);
    if (!agg) {
      agg = { hours: 0, lastAt: null, entries: [] };
      actByUser.set(userId, agg);
    }
    agg.hours += hours;
    if (!agg.lastAt || a.createdAt > agg.lastAt) agg.lastAt = a.createdAt;
    agg.entries.push({
      categoryName: a.category.name,
      hours: Math.round(hours * 100) / 100,
      projectName: a.assignment?.story?.project.name ?? null,
      storyTitle: a.assignment?.story?.title ?? null,
      storyExternalId: a.assignment?.story?.externalId ?? null,
    });
  }

  // Asignaciones activas esperadas en el día (para filas sin carga)
  const expected = testerIds.length
    ? await prisma.testerAssignment.findMany({
        where: {
          testerId: { in: testerIds },
          status: { in: [...ACTIVE_STATUSES] as AssignmentStatus[] },
          startDate: { lte: dayUtc },
          OR: [{ endDate: null }, { endDate: { gte: dayUtc } }],
        },
        select: {
          testerId: true,
          status: true,
          story: {
            select: {
              id: true,
              title: true,
              externalId: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  type ExpectedEntry = {
    projectId: string;
    projectName: string;
    storyId: string;
    storyTitle: string;
    storyExternalId: string | null;
    status: string;
  };
  const expectedByUser = new Map<string, ExpectedEntry[]>();
  for (const e of expected) {
    const userId = userByTesterId.get(e.testerId);
    if (!userId) continue;
    let arr = expectedByUser.get(userId);
    if (!arr) { arr = []; expectedByUser.set(userId, arr); }
    arr.push({
      projectId: e.story.project.id,
      projectName: e.story.project.name,
      storyId: e.story.id,
      storyTitle: e.story.title,
      storyExternalId: e.story.externalId ?? null,
      status: e.status,
    });
  }

  const rows = users.map((u) => {
    const d = dailyByUser.get(u.id);
    const a = actByUser.get(u.id);
    const exp = expectedByUser.get(u.id) ?? [];
    const clientById = new Map<string, string>();
    for (const t of u.testers) {
      const c = t.project.client;
      clientById.set(c.id, c.name);
    }
    const clients = [...clientById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((x, y) => x.name.localeCompare(y.name, "es"));
    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      clients,
      daily: d
        ? {
            loaded: true,
            storiesCount: d.storiesCount,
            designed: d.designed,
            executed: d.executed,
            defects: d.defects,
            lastAt: d.lastAt ? d.lastAt.toISOString() : null,
            entries: Array.from(d.entriesByAssignment.values()),
          }
        : { loaded: false, storiesCount: 0, designed: 0, executed: 0, defects: 0, lastAt: null, entries: [] },
      activities: a
        ? {
            loaded: true,
            hours: Math.round(a.hours * 100) / 100,
            lastAt: a.lastAt!.toISOString(),
            entries: a.entries,
          }
        : { loaded: false, hours: 0, lastAt: null, entries: [] },
      expectedAssignments: exp,
    };
  });

  const clientById = new Map<string, string>();
  for (const r of rows) for (const c of r.clients) clientById.set(c.id, c.name);
  const clients = [...clientById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((x, y) => x.name.localeCompare(y.name, "es"));

  res.json({ date: dateStr, isNonBusinessDay, clients, rows });
});

// POST /api/admin/send-daily-reminders?date=YYYY-MM-DD&dryRun=true
router.post("/send-daily-reminders", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const dateStr =
    (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const dryRun = req.query.dryRun === "true";
  const clientId = (req.query.clientId as string | undefined) || undefined;
  const day = toUtcDateOnly(dateStr);

  const testers = await findTestersWithMissingRecords(day, clientId);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const replyTo = process.env.ALERT_REPLY_TO;
  const dayLabelStr = day.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });

  let testersNotified = 0;
  let assignmentsFlagged = 0;
  const errors: Array<{ email: string; message: string }> = [];

  for (const t of testers) {
    try {
      const projectIds = [...new Set(t.missingAssignments.map((a) => a.projectId))];
      const cc = await resolveCcRecipients(projectIds);
      const { subject, html } = renderDailyAlert({
        testerName: t.testerName,
        dayLabel: dayLabelStr,
        missingAssignments: t.missingAssignments,
        appUrl,
      });
      if (!dryRun) {
        await sendMail({ to: t.email, cc, subject, html, replyTo });
      }
      testersNotified++;
      assignmentsFlagged += t.missingAssignments.length;
    } catch (err: any) {
      errors.push({ email: t.email, message: err?.message ?? String(err) });
    }
  }

  res.json({ date: dateStr, testersNotified, assignmentsFlagged, errors });
});

// GET /api/admin/hus-sin-registros?clientId=...
// HUs con datos faltantes que hacen que los informes salgan "vacíos". Dos tipos:
//  - kind "current": estado actual En Diseño (diseñados=0 en el CICLO ACTUAL) o
//    En Curso/Ejecución (ejecutados=0 en el ciclo actual). El analista no cargó
//    el avance del ciclo en curso. Se mira el último ciclo, no el histórico.
//  - kind "advanced": la HU ya AVANZÓ (Pdte. Instalación QA / Devuelto a Dev /
//    UAT / Producción) pero NUNCA registró una fase: diseñados=0 (histórico) y/o
//    ejecutados=0 cuando ya debió ejecutarse (ej. ejecutó sin diseñar).
// "cambió hoy" = entró a su estado hoy (puede que recién la trabajen).
// Agrupadas por proyecto, filtrables por cliente. Solo ADMIN.
router.get("/hus-sin-registros", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const clientId = (req.query.clientId as string | undefined) || undefined;
  const SLABEL: Record<string, string> = {
    TEST_DESIGN: "En Diseño",
    EXECUTION: "En Curso",
    WAITING_QA_DEPLOY: "Pdte. Instalación QA",
    RETURNED_TO_DEV: "Devuelto a Desarrollo",
    UAT: "En UAT",
    PRODUCTION: "En Producción",
  };
  const CANDIDATES = Object.keys(SLABEL);
  const ADVANCED = new Set(["WAITING_QA_DEPLOY", "RETURNED_TO_DEV", "UAT", "PRODUCTION"]);
  const EXEC_EXPECTED = new Set(["RETURNED_TO_DEV", "UAT", "PRODUCTION"]); // ya debió ejecutarse

  const stories = await prisma.userStory.findMany({
    where: {
      assignments: { some: { status: { in: CANDIDATES as AssignmentStatus[] } } },
      ...(clientId ? { project: { clientId } } : {}),
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      project: {
        select: { id: true, name: true, client: { select: { id: true, name: true } } },
      },
      assignments: {
        select: {
          status: true,
          startDate: true,
          tester: { select: { name: true, user: { select: { name: true } } } },
          dailyRecords: { select: { designed: true, executed: true } },
          statusLogs: { select: { changedAt: true }, orderBy: { changedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // "Hoy" en horario de Chile, para la marca "cambió hoy".
  const fmtCl = (d: Date) => d.toLocaleDateString("es-CL", { timeZone: "America/Santiago" });
  const todayCl = fmtCl(new Date());

  type Hu = {
    storyId: string;
    externalId: string | null;
    title: string;
    missing: string;
    kind: "current" | "advanced";
    statusLabel: string;
    testerName: string;
    since: string | null;
    changedToday: boolean;
  };
  const byProject = new Map<
    string,
    { projectId: string; projectName: string; clientName: string; hus: Hu[] }
  >();

  for (const s of stories) {
    const latest = s.assignments[0];
    if (!latest || !SLABEL[latest.status]) continue;
    const st = latest.status;

    // Ciclo actual (último assignment).
    let curDes = 0, curEje = 0;
    for (const r of latest.dailyRecords) { curDes += r.designed; curEje += r.executed; }
    // Histórico (todos los ciclos).
    let cumDes = 0, cumEje = 0;
    for (const a of s.assignments) for (const r of a.dailyRecords) { cumDes += r.designed; cumEje += r.executed; }

    let missing: string | null = null;
    let kind: "current" | "advanced" | null = null;
    if (st === "TEST_DESIGN") {
      if (curDes === 0) { missing = "Diseño"; kind = "current"; }
    } else if (st === "EXECUTION") {
      if (curEje === 0) { missing = "Ejecución"; kind = "current"; }
    } else if (ADVANCED.has(st)) {
      const noDes = cumDes === 0;
      const noEje = cumEje === 0 && EXEC_EXPECTED.has(st);
      if (noDes && noEje) { missing = "Diseño y Ejecución"; kind = "advanced"; }
      else if (noDes) { missing = "Diseño"; kind = "advanced"; }
      else if (noEje) { missing = "Ejecución"; kind = "advanced"; }
    }
    if (!missing || !kind) continue;

    const changedAt = latest.statusLogs[0]?.changedAt ?? null;
    const changedToday = changedAt ? fmtCl(changedAt) === todayCl : false;

    const grp = byProject.get(s.project.id) ?? {
      projectId: s.project.id,
      projectName: s.project.name,
      clientName: s.project.client.name,
      hus: [] as Hu[],
    };
    grp.hus.push({
      storyId: s.id,
      externalId: s.externalId,
      title: s.title,
      missing,
      kind,
      statusLabel: SLABEL[st] ?? st,
      testerName: latest.tester?.user?.name ?? latest.tester?.name ?? "—",
      since: latest.startDate ? latest.startDate.toISOString() : null,
      changedToday,
    });
    byProject.set(s.project.id, grp);
  }

  const projects = [...byProject.values()]
    .map((p) => ({
      ...p,
      // "advanced" primero (datos que faltan desde hace rato), luego no-cambió-hoy.
      hus: p.hus.sort(
        (a, b) =>
          Number(a.kind === "current") - Number(b.kind === "current") ||
          Number(a.changedToday) - Number(b.changedToday) ||
          a.title.localeCompare(b.title, "es"),
      ),
    }))
    .sort(
      (a, b) =>
        a.clientName.localeCompare(b.clientName, "es") ||
        a.projectName.localeCompare(b.projectName, "es"),
    );

  const allHus = projects.flatMap((p) => p.hus);
  res.json({
    generatedAt: new Date().toISOString(),
    totalHus: allHus.length,
    totalCurrent: allHus.filter((h) => h.kind === "current").length,
    totalAdvanced: allHus.filter((h) => h.kind === "advanced").length,
    totalChangedToday: allHus.filter((h) => h.changedToday).length,
    projects,
  });
});

export default router;
