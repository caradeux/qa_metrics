import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Limpiando datos de prueba (conservando users y roles)...');

  await prisma.dailyRecord.deleteMany({});
  await prisma.cycleBreakdown.deleteMany({});
  await prisma.testerAssignment.deleteMany({});
  await prisma.userStory.deleteMany({});
  await prisma.testCycle.deleteMany({});
  await prisma.tester.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.holiday.deleteMany({});

  const keep = ['admin@qametrics.com', 'tester1@qametrics.com', 'tester2@qametrics.com'];
  const deletedUsers = await prisma.user.deleteMany({ where: { email: { notIn: keep } } });
  console.log(`Users eliminados: ${deletedUsers.count}`);

  const users = await prisma.user.findMany({ select: { email: true, role: { select: { name: true } } } });
  console.log('Users conservados:');
  users.forEach(u => console.log(` - ${u.email} (${u.role.name})`));
  console.log('Listo.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
