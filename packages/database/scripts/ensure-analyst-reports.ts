import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const REPORT_PERMS: [string, string][] = [
  ["reports", "read"],
  ["reports-occupation", "read"],
  ["reports-stories", "read"],
];

async function main() {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "QA_ANALYST" } });

  for (const [resource, action] of REPORT_PERMS) {
    const perm = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      create: { resource, action },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  console.log(`OK: QA_ANALYST con ${REPORT_PERMS.length} permisos de reports asegurados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
