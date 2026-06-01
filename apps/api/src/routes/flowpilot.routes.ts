import { Router, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { getSession, flowpilotClient, FlowpilotNoCredentialError } from "../services/flowpilot-session.service.js";
import { FlowpilotInvalidCredentialError } from "../lib/flowpilot/client.js";
import { setCredential } from "../services/flowpilot-credential.service.js";
import { upsertMappingSchema } from "../validators/flowpilot.validator.js";

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

async function withCatalog<T>(req: AuthRequest, res: Response, fn: (session: any) => Promise<T>) {
  try {
    const session = await getSession(req.user!.id);
    res.json({ data: await fn(session) });
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
    await flowpilotClient.login(user.email, password); // valida contra FlowPilot
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
  await withCatalog(req, res, (s) => flowpilotClient.listClientsByEntityType(s, entityType));
});

router.get("/catalog/contracts", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (s) => flowpilotClient.listContractsByClient(s, clientId));
});

router.get("/catalog/projects", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const clientId = Number(req.query.clientId);
  if (!clientId) { res.status(400).json({ error: "clientId requerido" }); return; }
  await withCatalog(req, res, (s) => flowpilotClient.listProjectsByClient(s, clientId));
});

router.get("/catalog/task-types", async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  await withCatalog(req, res, (s) => flowpilotClient.listTaskTypes(s));
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

export default router;
