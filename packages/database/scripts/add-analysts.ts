import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const analyst = await prisma.role.findUniqueOrThrow({ where: { name: "QA_ANALYST" } });
  const hash = await bcrypt.hash("Inovabiz.2026", 12);
  const users = [
    { email: "b.benardis@inovabiz.com", name: "Braulio Benardis" },
    { email: "rgarcia@inovabiz.com", name: "Renato Garcia" },
    { email: "jflores@inovabiz.com", name: "Jose Flores" },
  ];
  for (const u of users) {
    const r = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, password: hash, name: u.name, roleId: analyst.id },
      update: { password: hash, roleId: analyst.id, name: u.name, active: true },
    });
    console.log("✓", r.email, r.name);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
