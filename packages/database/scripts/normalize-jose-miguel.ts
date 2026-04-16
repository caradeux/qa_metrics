import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Normaliza: User "jflores@inovabiz.com" pasa a llamarse "Jose Miguel Flores".
// Todos los Tester llamados "Jose Flores" o "Jose Miguel Flores" quedan como
// "Jose Miguel Flores" con userId apuntando al mismo User.

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "jflores@inovabiz.com" },
    select: { id: true, name: true },
  });
  if (!user) {
    console.log("No existe User con email jflores@inovabiz.com; abortando.");
    return;
  }
  console.log(`User actual: ${user.name} → actualizando a "Jose Miguel Flores"`);
  await prisma.user.update({ where: { id: user.id }, data: { name: "Jose Miguel Flores" } });

  const testers = await prisma.tester.findMany({
    where: { name: { in: ["Jose Flores", "Jose Miguel Flores"] } },
    include: { project: { select: { name: true } } },
  });
  for (const t of testers) {
    const changes: { name?: string; userId?: string } = {};
    if (t.name !== "Jose Miguel Flores") changes.name = "Jose Miguel Flores";
    if (t.userId !== user.id) changes.userId = user.id;
    if (Object.keys(changes).length === 0) {
      console.log(`  ok (ya correcto): ${t.name} en ${t.project.name}`);
      continue;
    }
    await prisma.tester.update({ where: { id: t.id }, data: changes });
    console.log(`  ✓ ${t.name} (${t.project.name}) → Jose Miguel Flores, userId=${user.id}`);
  }

  console.log(`\nOK: User normalizado y ${testers.length} testers revisados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
