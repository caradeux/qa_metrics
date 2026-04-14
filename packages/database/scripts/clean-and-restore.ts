import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Limpiando seed demo (conservando ADMINs)...");
  await prisma.assignmentStatusLog.deleteMany({});
  await prisma.testerAssignment.deleteMany({});
  await prisma.dailyRecord.deleteMany({});
  await prisma.cycleBreakdown.deleteMany({});
  await prisma.userStory.deleteMany({});
  await prisma.testCycle.deleteMany({});
  await prisma.tester.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.client.deleteMany({});

  const keep = ["admin@qametrics.com", "jcaradeux@inovabiz.com"];
  const deleted = await prisma.user.deleteMany({ where: { email: { notIn: keep } } });
  console.log(`Eliminados ${deleted.count} users demo.`);

  // Recreate Braulio
  const analyst = await prisma.role.findUniqueOrThrow({ where: { name: "QA_ANALYST" } });
  const hash = await bcrypt.hash("Inovabiz.2026", 12);
  const braulio = await prisma.user.upsert({
    where: { email: "b.benardis@inovabiz.com" },
    create: { email: "b.benardis@inovabiz.com", password: hash, name: "Braulio Benardis", roleId: analyst.id },
    update: { password: hash, roleId: analyst.id, active: true },
  });
  console.log("Recreado:", braulio.email);

  const users = await prisma.user.findMany({ select: { email: true, role: { select: { name: true } } } });
  console.log("Users finales:");
  users.forEach(u => console.log(` - ${u.email} [${u.role.name}]`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
