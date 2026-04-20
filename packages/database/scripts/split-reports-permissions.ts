import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

// Split de reports en reports-occupation y reports-stories (2026-04-20).
// A todo rol que hoy tenga reports:read le damos también reports-occupation:read
// y reports-stories:read para preservar acceso.
const NEW_RESOURCES = ["reports-occupation", "reports-stories"] as const;
const ACTIONS = ["create", "read", "update", "delete"] as const;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

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
  // 1. Asegurar que los 8 permisos nuevos existen como filas en Permission
  const perms: Record<string, { id: string }> = {};
  for (const resource of NEW_RESOURCES) {
    for (const action of ACTIONS) {
      perms[`${resource}:${action}`] = await upsertPermission(resource, action);
    }
  }
  console.log(`OK: ${NEW_RESOURCES.length * ACTIONS.length} filas Permission aseguradas.`);

  // 2. Encontrar todos los roles que hoy tengan reports:read
  const reportsReadPerm = await prisma.permission.findUnique({
    where: { resource_action: { resource: "reports", action: "read" } },
  });
  if (!reportsReadPerm) {
    console.log("No existe reports:read como fila Permission — nada que migrar.");
    return;
  }

  const rolesWithReportsRead = await prisma.rolePermission.findMany({
    where: { permissionId: reportsReadPerm.id },
    select: { roleId: true },
  });

  // 3. A cada uno agregar reports-occupation:read y reports-stories:read (idempotente)
  for (const { roleId } of rolesWithReportsRead) {
    await linkRolePermission(roleId, perms["reports-occupation:read"].id);
    await linkRolePermission(roleId, perms["reports-stories:read"].id);
  }

  console.log(
    `OK: ${rolesWithReportsRead.length} rol(es) con reports:read extendidos a reports-occupation:read + reports-stories:read.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
