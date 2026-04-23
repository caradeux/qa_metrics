/**
 * purge-non-demo.ts
 *
 * Borra todos los clientes (y por cascade: proyectos, testers, stories,
 * cycles, assignments, phases, records, activities) que NO tengan
 * prefijo "[DEMO]" en su nombre. Solo corre en local.
 *
 * NO toca: usuarios, roles, permisos, feriados, categorías de actividad.
 *
 * Protecciones:
 *   - NODE_ENV === "production" → bloqueado
 *   - DATABASE_URL sin "localhost" / "127.0.0.1" → bloqueado
 *
 * Uso:
 *   cd qa-metrics
 *   tsx packages/database/scripts/purge-non-demo.ts
 *
 * Flujo típico para preparar capturas limpias:
 *   tsx packages/database/scripts/purge-non-demo.ts
 *   tsx packages/database/scripts/seed-local-demo.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Guard-rails ─────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  console.error("❌ PURGE BLOQUEADO: NODE_ENV=production");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1|::1/i.test(dbUrl);
if (!isLocal) {
  console.error(`❌ PURGE BLOQUEADO: DATABASE_URL no apunta a localhost`);
  console.error(`   Actual: ${dbUrl.replace(/:[^:@/]*@/, ":***@")}`);
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// ── Main ───────────────────────────────────────────────────────────

const DEMO_PREFIX = "[DEMO]";

async function main() {
  console.log("🧹 Purge non-DEMO iniciando...");
  console.log(`   DB: ${dbUrl.replace(/:[^:@/]*@/, ":***@")}`);

  // 1. Snapshot de qué hay
  const allClients = await prisma.client.findMany({
    select: { id: true, name: true },
  });
  const demoIds = new Set(
    allClients.filter((c) => c.name.startsWith(DEMO_PREFIX)).map((c) => c.id),
  );
  const toDelete = allClients.filter((c) => !demoIds.has(c.id));

  console.log(`\n📊 Estado actual:`);
  console.log(`   Total clientes: ${allClients.length}`);
  console.log(`   Clientes DEMO:  ${demoIds.size}`);
  console.log(`   A eliminar:     ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("\n✅ No hay clientes no-DEMO para eliminar. Nada que hacer.");
    return;
  }

  console.log(`\n🗑️  Clientes que se van a eliminar (y todo lo que cuelga):`);
  toDelete.slice(0, 20).forEach((c) => console.log(`   - ${c.name}`));
  if (toDelete.length > 20) {
    console.log(`   ... y ${toDelete.length - 20} más`);
  }

  // 2. Conteo de data asociada (solo informativo)
  const projectCount = await prisma.project.count({
    where: { clientId: { in: toDelete.map((c) => c.id) } },
  });
  console.log(`\n📉 Data asociada que cascade elimina:`);
  console.log(`   Proyectos:    ${projectCount} (y sus testers, stories, cycles, records, etc.)`);

  // 3. Ejecutar delete (Client.onDelete Cascade hace el resto)
  console.log(`\n⚙️  Eliminando...`);
  const result = await prisma.client.deleteMany({
    where: { id: { in: toDelete.map((c) => c.id) } },
  });
  console.log(`   ✓ ${result.count} clientes eliminados`);

  // 4. Verificación
  const remainingClients = await prisma.client.count();
  const remainingProjects = await prisma.project.count();
  const remainingStories = await prisma.userStory.count();
  const remainingRecords = await prisma.dailyRecord.count();

  console.log(`\n📊 Estado final:`);
  console.log(`   Clientes restantes:       ${remainingClients}`);
  console.log(`   Proyectos restantes:      ${remainingProjects}`);
  console.log(`   User stories restantes:   ${remainingStories}`);
  console.log(`   Daily records restantes:  ${remainingRecords}`);

  console.log(`\n✅ Purge completado. Ahora puedes correr seed-local-demo.ts si hace falta.`);
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
