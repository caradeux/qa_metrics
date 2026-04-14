import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const role = await prisma.role.upsert({
    where: { name: 'CLIENT_PM' },
    create: { name: 'CLIENT_PM', description: 'Jefe de Proyecto del Cliente (solo lectura de proyectos asignados)', isSystem: true },
    update: {},
  });

  const perms = [
    ['clients', 'read'],
    ['projects', 'read'],
    ['cycles', 'read'],
    ['testers', 'read'],
    ['records', 'read'],
    ['assignments', 'read'],
    ['reports', 'read'],
  ] as const;

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
  console.log('Rol CLIENT_PM listo con', perms.length, 'permisos');
}
main().catch(console.error).finally(() => prisma.$disconnect());
