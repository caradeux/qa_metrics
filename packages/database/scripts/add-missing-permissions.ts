import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Recursos nuevos a incorporar al RBAC (2026-04-16).
// "stories" ya existía en seed pero faltaba en UI; el resto son nuevos.
const NEW_RESOURCES = ["stories", "phases", "dashboard", "gantt", "story-status", "audit", "holidays"] as const;
const ACTIONS = ["create", "read", "update", "delete"] as const;

async function upsertPermission(resource: string, action: string) {
  return prisma.permission.upsert({
    where: { resource_action: { resource, action } },
    create: { resource, action },
    update: {},
  });
}

async function linkRolePermission(roleId: string, permissionId: string) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    create: { roleId, permissionId },
    update: {},
  });
}

async function main() {
  // 1. Crear los Permission rows faltantes (todas las acciones de los recursos nuevos)
  const perms: Record<string, { id: string }> = {};
  for (const resource of NEW_RESOURCES) {
    for (const action of ACTIONS) {
      perms[`${resource}:${action}`] = await upsertPermission(resource, action);
    }
  }

  // 2. Propagar a los roles según su política
  const admin = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  const qaLead = await prisma.role.findUnique({ where: { name: "QA_LEAD" } });
  const qaAnalyst = await prisma.role.findUnique({ where: { name: "QA_ANALYST" } });
  const clientPm = await prisma.role.findUnique({ where: { name: "CLIENT_PM" } });

  // ADMIN: todo
  if (admin) {
    for (const perm of Object.values(perms)) {
      await linkRolePermission(admin.id, perm.id);
    }
  }

  // QA_LEAD: CRUD en stories + phases, read en dashboard + gantt + audit, update en story-status
  if (qaLead) {
    for (const action of ACTIONS) {
      await linkRolePermission(qaLead.id, perms[`stories:${action}`].id);
      await linkRolePermission(qaLead.id, perms[`phases:${action}`].id);
    }
    await linkRolePermission(qaLead.id, perms["dashboard:read"].id);
    await linkRolePermission(qaLead.id, perms["gantt:read"].id);
    await linkRolePermission(qaLead.id, perms["story-status:update"].id);
    await linkRolePermission(qaLead.id, perms["audit:read"].id);
    // Holidays: CRUD completo para que el Líder QA mantenga el calendario
    for (const action of ACTIONS) {
      await linkRolePermission(qaLead.id, perms[`holidays:${action}`].id);
    }
  }

  // QA_ANALYST: read en todos (menos story-status que solo tiene update); create/update en phases; update en story-status
  if (qaAnalyst) {
    for (const resource of NEW_RESOURCES) {
      if (resource === "story-status") continue; // solo update, sin read
      await linkRolePermission(qaAnalyst.id, perms[`${resource}:read`].id);
    }
    await linkRolePermission(qaAnalyst.id, perms["phases:create"].id);
    await linkRolePermission(qaAnalyst.id, perms["phases:update"].id);
    await linkRolePermission(qaAnalyst.id, perms["story-status:update"].id);
    await linkRolePermission(qaAnalyst.id, perms["stories:create"].id);
    await linkRolePermission(qaAnalyst.id, perms["stories:update"].id);
  }

  // CLIENT_PM: solo read (sin story-status ni audit)
  if (clientPm) {
    for (const resource of NEW_RESOURCES) {
      if (resource === "story-status" || resource === "audit") continue;
      await linkRolePermission(clientPm.id, perms[`${resource}:read`].id);
    }
  }

  console.log(`OK: ${NEW_RESOURCES.length} recursos × ${ACTIONS.length} acciones asegurados y vinculados a roles.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
