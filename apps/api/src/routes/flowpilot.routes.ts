import { Router, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "@qa-metrics/database";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { getSession, flowpilotClient, FlowpilotNoCredentialError } from "../services/flowpilot-session.service.js";
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
    if (e instanceof FlowpilotNoCredentialError) {
      res.status(409).json({ error: e.message });
      return;
    }
    res.status(502).json({ error: "Error consultando FlowPilot", detail: (e as Error).message });
  }
}

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
