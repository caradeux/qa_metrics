import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  });
  console.log("Usuarios:");
  users.forEach((u) =>
    console.log(`  ${u.role.name.padEnd(14)} ${u.email} (${u.name})`),
  );

  const clients = await prisma.client.findMany({
    select: { name: true, user: { select: { email: true } } },
  });
  console.log("\nClientes y su owner:");
  clients.forEach((c) => console.log(`  ${c.name} -> owner: ${c.user.email}`));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
