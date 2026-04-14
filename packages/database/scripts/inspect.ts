import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, name: true, role: { select: { name: true } } } });
  const clients = await prisma.client.count();
  const projects = await prisma.project.count();
  const testers = await prisma.tester.count();
  console.log("USERS:");
  users.forEach(u => console.log(` - ${u.email} (${u.name}) [${u.role.name}]`));
  console.log(`CLIENTS: ${clients}, PROJECTS: ${projects}, TESTERS: ${testers}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
