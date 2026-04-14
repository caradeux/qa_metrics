import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "QA_ANALYST" } });

  // QA Analyst ahora puede registrar HUs, crear ciclos y asignarse (read + create + update).
  const perms: [string, string][] = [
    ["clients", "read"],
    ["projects", "read"],
    // Historias de usuario
    ["stories", "read"], ["stories", "create"], ["stories", "update"],
    // Ciclos
    ["cycles", "read"], ["cycles", "create"], ["cycles", "update"],
    // Testers
    ["testers", "read"],
    // Registros diarios
    ["records", "read"], ["records", "create"], ["records", "update"],
    // Asignaciones (se asigna a sí mismo)
    ["assignments", "read"], ["assignments", "create"], ["assignments", "update"],
    // Reportes (solo lectura)
    ["reports", "read"],
  ];

  for (const [resource, action] of perms) {
    const p = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      create: { resource, action },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      create: { roleId: role.id, permissionId: p.id },
      update: {},
    });
  }
  console.log(`Rol QA_ANALYST actualizado con ${perms.length} permisos.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
