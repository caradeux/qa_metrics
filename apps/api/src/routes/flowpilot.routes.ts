import { Router, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { getSession, buildClient, getBaseUrl, setBaseUrl, ENV_BASE_URL, FlowpilotNoCredentialError } from "../services/flowpilot-session.service.js";
import { FlowpilotInvalidCredentialError } from "../lib/flowpilot/client.js";
import { setCredential } from "../services/flowpilot-credential.service.js";
import { upsertMappingSchema } from "../validators/flowpilot.validator.js";
import { buildDayPreview } from "../lib/flowpilot/day-entries.js";
import { workdaysInRange, toUtcDateOnly, isWorkday } from "../lib/workdays.js";
import crypto from "node:crypto";

const router = Router();
router.use(authMiddleware as any);

const ADMIN_ROLES = new Set(["ADMIN", "QA_LEAD"]);
function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!ADMIN_ROLES.has(req.user?.role?.name ?? "")) {
    res.status(403).json({ error: "Solo ADMIN/QA_LEAD" });
    return false;
  }
  return true;
}

// La URL de FlowPilot es a donde se envía el password descifrado de cada analista,
// así que solo se permite https hacia hosts EXACTOS conocidos (+ subdominios de
// flowpilot.biz, que FlowPilot controla). NO se usa un sufijo compartido como
// azurewebsites.net porque cualquiera puede registrar subdominios ahí y
// exfiltrar credenciales / hacer SSRF a direcciones internas. Ampliable por
// entorno (FLOWPILOT_ALLOWED_HOSTS) si FlowPilot migra de dominio.
const ALLOWED_HOSTS = (process.env.FLOWPILOT_ALLOWED_HOSTS ||
  "flowpilot.biz,wap-asignacion-semanal-horas-qa.azurewebsites.net")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.includes(host) || host.endsWith(".flowpilot.biz");
}

function validateFlowpilotUrl(raw: string): { ok: true; origin: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: "URL inválida (ej. https://flowpilot.biz)" }; }
  if (u.protocol !== "https:") return { ok: false, error: "Solo se permite https" };
  if (!isAllowedHost(u.hostname.toLowerCase())) {
    return { ok: false, error: `Host no permitido. Hosts válidos: ${ALLOWED_HOSTS.join(", ")} (o subdominios de flowpilot.biz)` };
  }
  return { ok: true, origin: `${u.protocol}//${u.host}` };
}

async function withCatalog<T>(req: AuthRequest, res: Response, fn: (client: any, session: any) => Promise<T>) {
  try {
    const { client, session } = await getSession(req.user!.id);
    res.json({ data: await fn(client, session) });
  } catch (e) {
    // Sin credencial o credencial inválida → 409 con code para que el front
    // ofrezca el modal "Conectar con FlowPilot".
    if (e instanceof FlowpilotNoCredentialError || e instanceof FlowpilotInvalidCredentialError) {
      res.status(409).json({ error: e.message, code: "FLOWPILOT_AUTH" });
      return;
    }
    res.status(502).json({ error: "Error consultando FlowPilot", detail: (e as Error).message });
  }
}

// Conectar / re-conectar la credencial FlowPilot del usuario actual.
// Valida el usuario+clave contra FlowPilot y, si autentica, la guarda cifrada.
// Disponible para cualquier usuario autenticado (conecta SU propia cuenta).
router.post("/connection", async (req: AuthRequest, res) => {
  const password = (req.body ?? {}).password;
  if (typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "password requerido" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { email: true },
  });
  if (!user) { res.status(404).json({ error: "usuario no encontrado" }); return; }

  try {
    const client = await buildClient();
    await client.login(user.email, password); // valida contra FlowPilot
  } catch (e) {
    if (e instanceof FlowpilotInvalidCredentialError) {
      res.status(401).json({ valid: false, error: e.message });
      return;
    }
    res.status(502).json({ valid: false, error: "No se pudo contactar a FlowPilot" });
    return;
  }

  await setCredential(req.user!.id, password);
  await prisma.flowpilotConnection.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, valid: true, lastValidatedAt: new Date() },
    update: { valid: true, lastValidatedAt: new Date() },
  });
  res.json({ valid: true, email: user.email });
});

// Estado de la conexión del usuario actual.
router.get("/connection", async (req: AuthRequest, res) => {
  const [conn, user] = await Promise.all([
    prisma.flowpilotConnection.findUnique({ where: { userId: req.user!.id } }),
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } }),
  ]);
  res.json({
    email: user?.email ?? null,
    valid: conn?.valid ?? false,
    lastValidatedAt: conn?.lastValidatedAt ?? null,
  });
});

router.get("/catalog/clients", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const entityType = req.query.entityType === "project" ? "project" : "contract";
  await withCatalog(req, res, (c, s) => c.listClientsByEntityType(s, entityType));
});

router.get("/catalog/contracts", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (c, s) => c.listContractsByClient(s, clientId));
});

router.get("/catalog/projects", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (c, s) => c.listProjectsByClient(s, clientId));
});

router.get("/catalog/task-types", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  await withCatalog(req, res, (c, s) => c.listTaskTypes(s));
});

// Configuración de la integración (URL base de FlowPilot). Solo ADMIN/QA_LEAD.
router.get("/config", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const baseUrl = await getBaseUrl();
  res.json({ baseUrl, envDefault: ENV_BASE_URL, isCustom: baseUrl !== ENV_BASE_URL });
});

router.put("/config", async (req: AuthRequest, res) => {
  // Cambiar la URL define a dónde se envían las credenciales de TODOS los
  // analistas → restringido a ADMIN (no QA_LEAD).
  if (req.user?.role?.name !== "ADMIN") {
    res.status(403).json({ error: "Solo ADMIN puede cambiar la URL de FlowPilot" });
    return;
  }
  const v = validateFlowpilotUrl(String((req.body ?? {}).baseUrl ?? "").trim());
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  await setBaseUrl(v.origin);
  res.json({ baseUrl: v.origin, envDefault: ENV_BASE_URL, isCustom: v.origin !== ENV_BASE_URL });
});

router.get("/mappings", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const userId = req.query.userId as string | undefined;
  if (!userId) { res.status(400).json({ error: "userId requerido" }); return; }
  const rows = await prisma.flowpilotMapping.findMany({ where: { userId }, orderBy: { kind: "asc" } });
  res.json(rows);
});

router.put("/mappings", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const d = upsertMappingSchema.parse(req.body);
    const row = await prisma.flowpilotMapping.upsert({
      where: { userId_kind: { userId: d.userId, kind: d.kind } },
      create: {
        userId: d.userId, kind: d.kind, entityType: d.entityType,
        clientId: d.clientId, clientName: d.clientName,
        contractId: d.contractId ?? null, projectId: d.projectId ?? null,
        entityName: d.entityName, taskTypeId: d.taskTypeId, taskTypeName: d.taskTypeName,
      },
      update: {
        entityType: d.entityType, clientId: d.clientId, clientName: d.clientName,
        contractId: d.contractId ?? null, projectId: d.projectId ?? null,
        entityName: d.entityName, taskTypeId: d.taskTypeId, taskTypeName: d.taskTypeName,
      },
    });
    res.json(row);
  } catch (e) {
    if (e instanceof ZodError) { res.status(400).json({ errors: e.errors }); return; }
    throw e;
  }
});

router.delete("/mappings/:id", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  await prisma.flowpilotMapping.deleteMany({ where: { id: req.params.id as string } });
  res.status(204).send();
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 24 * 60 * 60 * 1000;

// Días hábiles con su estado de carga: con datos / enviado.
// Acepta un rango (from/to, p.ej. una semana) o, por defecto, los últimos N días.
// Alimenta el calendario semanal de gestión de la página Registro de Horas.
router.get("/pending", async (req: AuthRequest, res) => {
  const today = toUtcDateOnly(new Date());
  let from: Date;
  let to: Date;
  const qf = req.query.from as string | undefined;
  const qt = req.query.to as string | undefined;
  if (qf && qt && DATE_RE.test(qf) && DATE_RE.test(qt)) {
    from = toUtcDateOnly(qf);
    to = toUtcDateOnly(qt);
  } else {
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 14));
    to = today;
    from = new Date(today.getTime() - (days - 1) * MS_DAY);
  }

  const testers = await prisma.tester.findMany({ where: { userId: req.user!.id }, select: { id: true } });
  const testerIds = testers.map((t) => t.id);

  const [workdays, records, activities, logs] = await Promise.all([
    workdaysInRange(from, to),
    prisma.dailyRecord.findMany({
      where: { testerId: { in: testerIds }, date: { gte: from, lte: to } },
      select: { date: true },
    }),
    prisma.activity.findMany({
      where: { testerId: { in: testerIds }, startAt: { gte: from, lt: new Date(to.getTime() + MS_DAY) } },
      select: { startAt: true },
    }),
    prisma.flowpilotSyncLog.findMany({
      where: { userId: req.user!.id, status: "SENT", date: { gte: from, lte: to } },
      select: { date: true },
    }),
  ]);

  const iso = (d: Date) => toUtcDateOnly(d).toISOString().slice(0, 10);
  const dataDates = new Set<string>();
  for (const r of records) dataDates.add(iso(r.date));
  for (const a of activities) dataDates.add(iso(a.startAt));
  const sentDates = new Set(logs.map((l) => iso(l.date)));

  const out = workdays.map((d) => {
    const k = iso(d);
    return { date: k, hasData: dataDates.has(k), sent: sentDates.has(k) };
  });
  res.json({ days: out, from: iso(from), to: iso(to), today: iso(today) });
});


// Preview del día del usuario actual (no envía nada).
router.get("/preview", async (req: AuthRequest, res) => {
  const date = req.query.date as string | undefined;
  if (!date || !DATE_RE.test(date)) { res.status(400).json({ error: "date=YYYY-MM-DD requerido" }); return; }
  const [preview, workday, log] = await Promise.all([
    buildDayPreview(req.user!.id, date),
    isWorkday(date),
    prisma.flowpilotSyncLog.findUnique({ where: { userId_date: { userId: req.user!.id, date: new Date(`${date}T00:00:00`) } } }),
  ]);
  res.json({
    ...preview,
    isNonBusinessDay: !workday,
    sync: log ? { status: log.status, sentAt: log.sentAt, hoursTotal: log.hoursTotal } : null,
  });
});

// Envía el día a FlowPilot. Body: { date, entries: [{kind, description, hours}] }.
// Idempotente: si ya se envió y el contenido cambió, borra las entradas previas y recrea.
router.post("/sync", async (req: AuthRequest, res) => {
  const date = (req.body ?? {}).date;
  const rawEntries = (req.body ?? {}).entries;
  if (!date || !DATE_RE.test(date) || !Array.isArray(rawEntries)) {
    res.status(400).json({ error: "date y entries requeridos" }); return;
  }
  // Re-resolver destinos desde la homologación (no confiar en el cliente para el destino).
  const mappings = await prisma.flowpilotMapping.findMany({ where: { userId: req.user!.id } });
  const mapByKind = new Map(mappings.map((m) => [m.kind, m]));

  const entries = rawEntries.map((e: any) => ({
    kind: String(e.kind),
    description: String(e.description ?? "").trim(),
    hours: Number(e.hours),
    m: mapByKind.get(String(e.kind)),
  }));
  if (entries.some((e) => !e.description)) { res.status(400).json({ error: "Toda entrada requiere descripción" }); return; }
  if (entries.some((e) => !(e.hours > 0))) { res.status(400).json({ error: "Horas inválidas" }); return; }
  if (entries.some((e) => !e.m)) { res.status(400).json({ error: "Hay entradas sin homologar; pide a un admin homologar su tipo." }); return; }
  const total = entries.reduce((s, e) => s + e.hours, 0);
  if (total > 8 + 1e-9) { res.status(400).json({ error: `El total (${total}h) supera las 8h diarias.` }); return; }

  const payloadHash = crypto.createHash("sha256")
    .update(JSON.stringify(entries.map((e) => ({ k: e.kind, d: e.description, h: e.hours }))))
    .digest("hex");

  const dateObj = new Date(`${date}T00:00:00`);
  const prev = await prisma.flowpilotSyncLog.findUnique({ where: { userId_date: { userId: req.user!.id, date: dateObj } } });
  if (prev && prev.status === "SENT" && prev.payloadHash === payloadHash) {
    res.json({ ok: true, unchanged: true, entryIds: prev.entryIds }); return;
  }

  let client, session;
  try { ({ client, session } = await getSession(req.user!.id)); }
  catch (e) {
    if (e instanceof FlowpilotNoCredentialError || e instanceof FlowpilotInvalidCredentialError) {
      res.status(409).json({ error: e.message, code: "FLOWPILOT_AUTH" }); return;
    }
    res.status(502).json({ error: "No se pudo contactar a FlowPilot" }); return;
  }

  // Crear PRIMERO las entradas nuevas; recién después borrar las anteriores.
  // Así, si el proceso se interrumpe, en el peor caso quedan duplicadas
  // (recuperable) en vez de perderse.
  const createdIds: number[] = [];
  try {
    for (const e of entries) {
      const m = e.m!; // garantizado por la validación previa (entries.some(!e.m) → 400)
      const created = await client.createEntry(session, {
        entityType: m.entityType as "contract" | "project",
        clientId: m.clientId, taskTypeId: m.taskTypeId,
        date, hoursWorked: e.hours, description: e.description,
        contractId: m.contractId, projectId: m.projectId,
      });
      createdIds.push(created.id);
    }
  } catch (err) {
    await prisma.flowpilotSyncLog.upsert({
      where: { userId_date: { userId: req.user!.id, date: dateObj } },
      create: { userId: req.user!.id, date: dateObj, entryIds: createdIds, hoursTotal: total, status: "PARTIAL", payloadHash },
      update: { entryIds: createdIds, hoursTotal: total, status: "PARTIAL", payloadHash },
    });
    res.status(502).json({ error: "Falló el envío parcial a FlowPilot", created: createdIds.length }); return;
  }

  // Borrar las entradas del envío anterior (FlowPilot no deduplica). Best-effort:
  // si falla, las nuevas ya están y el SyncLog apuntará a ellas.
  if (prev && prev.entryIds.length) {
    for (const id of prev.entryIds) { try { await client.deleteEntry(session, id); } catch { /* continuar */ } }
  }

  await prisma.flowpilotSyncLog.upsert({
    where: { userId_date: { userId: req.user!.id, date: dateObj } },
    create: { userId: req.user!.id, date: dateObj, entryIds: createdIds, hoursTotal: total, status: "SENT", payloadHash },
    update: { entryIds: createdIds, hoursTotal: total, status: "SENT", payloadHash },
  });
  res.json({ ok: true, entryIds: createdIds, hoursTotal: total });
});

export default router;
