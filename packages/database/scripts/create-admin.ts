import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "jcaradeux@inovabiz.com";
  const password = "QaMetrics2024!";
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hash, name: "Jose Caradeux", roleId: role.id },
    update: { password: hash, roleId: role.id, active: true },
  });
  console.log("Admin listo:", user.email, "rol:", role.name);
}
main().catch(console.error).finally(() => prisma.$disconnect());
