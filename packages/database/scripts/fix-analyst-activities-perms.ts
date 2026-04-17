import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  // Find QA_ANALYST role
  const role = await prisma.role.findFirst({ where: { name: "QA_ANALYST" } });
  if (!role) throw new Error("QA_ANALYST role not found");

  // Remove activities:create/update/delete from QA_ANALYST
  // (analysts can read categories but not manage them)
  const permsToRemove = await prisma.permission.findMany({
    where: {
      resource: "activities",
      action: { in: ["create", "update", "delete"] },
    },
  });

  console.log("Permissions to remove from QA_ANALYST:", permsToRemove.map((p) => `${p.resource}:${p.action}`));

  for (const perm of permsToRemove) {
    const deleted = await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: perm.id },
    });
    console.log(`  Removed ${deleted.count} link(s) for activities:${perm.action}`);
  }

  console.log("Done. QA_ANALYST now has only activities:read.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
