import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/**
 * Vincula automáticamente cada Tester con userId=null al User del mismo nombre
 * (role QA_ANALYST), usando comparación case-insensitive + trim.
 *
 * Motivación: si un Tester no tiene userId, el analista con ese nombre no puede
 * ver el proyecto en /projects (el filtro es testers.some({ userId })).
 *
 * Idempotente: se puede correr múltiples veces sin efecto secundario.
 */
async function main() {
  const unlinked = await prisma.tester.findMany({
    where: { userId: null },
    include: { project: { select: { name: true } } },
  });

  if (unlinked.length === 0) {
    console.log("OK: no hay testers sin vincular.");
    return;
  }

  const analysts = await prisma.user.findMany({
    where: { role: { name: "QA_ANALYST" }, active: true },
    select: { id: true, name: true, email: true },
  });
  const byNormalized = new Map<string, { id: string; email: string }>();
  for (const u of analysts) {
    byNormalized.set(u.name.trim().toLowerCase(), { id: u.id, email: u.email });
  }

  let linked = 0;
  let skipped = 0;
  for (const t of unlinked) {
    const match = byNormalized.get(t.name.trim().toLowerCase());
    if (!match) {
      console.log(`  - SKIP  ${t.name} (${t.project.name}): no hay User QA_ANALYST con ese nombre`);
      skipped++;
      continue;
    }
    await prisma.tester.update({ where: { id: t.id }, data: { userId: match.id } });
    console.log(`  ✓ LINK  ${t.name} (${t.project.name}) → ${match.email}`);
    linked++;
  }

  console.log(`\nOK: ${linked} tester(s) vinculado(s), ${skipped} sin match (requieren vinculación manual).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
