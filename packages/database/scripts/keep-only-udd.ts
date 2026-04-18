/**
 * One-off: deja en la BD SOLO al cliente "Universidad del Desarrollo" y
 * su ecosistema (proyectos, HUs, ciclos, testers, asignaciones, registros
 * y actividades). Elimina todo lo demás que llegó a prod por el seed
 * (clientes de prueba, sus proyectos, Carlos Méndez y Laura Gómez, etc.).
 *
 * Preserva ÚNICAMENTE:
 *   - jcaradeux@inovabiz.com (el admin real)
 *   - Usuarios linkeados como Tester.userId dentro de UDD
 *   - Usuarios PM de algún proyecto de UDD
 *
 * Antes de borrar, si UDD pertenece a algún usuario que vamos a eliminar
 * (p.ej. admin@qametrics.com que venía del seed), se reasigna UDD a Jose.
 *
 * Uso:
 *   cd packages/database
 *   npx tsx scripts/keep-only-udd.ts            # dry-run (default)
 *   npx tsx scripts/keep-only-udd.ts --confirm  # elimina de verdad
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const KEEP_CLIENT_NAME = "Universidad del Desarrollo";
const REAL_ADMIN_EMAIL = "jcaradeux@inovabiz.com";
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  console.log("=".repeat(60));
  console.log(`Modo: ${CONFIRM ? "🔴 CONFIRM (elimina)" : "🟡 DRY-RUN (solo audita)"}`);
  console.log(`Cliente a preservar: "${KEEP_CLIENT_NAME}"`);
  console.log(`Admin real:          "${REAL_ADMIN_EMAIL}"`);
  console.log("=".repeat(60));

  // 0. Verificar que el admin real exista
  const realAdmin = await prisma.user.findUnique({
    where: { email: REAL_ADMIN_EMAIL },
    select: { id: true, name: true, role: { select: { name: true } } },
  });
  if (!realAdmin) {
    console.error(`❌ No existe el usuario ${REAL_ADMIN_EMAIL}. Abortando para no dejar huérfano al cliente.`);
    return;
  }
  console.log(`\n✓ Admin real encontrado: ${realAdmin.name} [${realAdmin.role.name}] (id: ${realAdmin.id})`);

  // 1. Buscar cliente a preservar
  const keepClients = await prisma.client.findMany({
    where: { name: { contains: KEEP_CLIENT_NAME, mode: "insensitive" } },
    select: { id: true, name: true, userId: true },
  });
  if (keepClients.length === 0) {
    console.error(`❌ No se encontró cliente cuyo nombre contenga "${KEEP_CLIENT_NAME}". Abortando.`);
    return;
  }
  console.log(`\n✓ Clientes preservados (${keepClients.length}):`);
  for (const c of keepClients) console.log(`  · ${c.name} (owner userId: ${c.userId})`);
  const keepClientIds = keepClients.map((c) => c.id);

  // 2. Proyectos de esos clientes
  const keepProjects = await prisma.project.findMany({
    where: { clientId: { in: keepClientIds } },
    select: { id: true, name: true, projectManagerId: true },
  });
  const keepProjectIds = keepProjects.map((p) => p.id);
  console.log(`\n  Proyectos preservados (${keepProjects.length}):`);
  for (const p of keepProjects) console.log(`  · ${p.name}`);

  // 3. Testers de esos proyectos
  const keepTesters = await prisma.tester.findMany({
    where: { projectId: { in: keepProjectIds } },
    select: { id: true, name: true, userId: true },
  });
  console.log(`  Testers preservados: ${keepTesters.length}`);

  // 4. Usuarios a preservar: el admin real + linkeados a UDD (tester.userId, PM)
  const keepUserIds = new Set<string>([realAdmin.id]);
  for (const p of keepProjects) if (p.projectManagerId) keepUserIds.add(p.projectManagerId);
  for (const t of keepTesters) if (t.userId) keepUserIds.add(t.userId);

  const keepUsers = await prisma.user.findMany({
    where: { id: { in: [...keepUserIds] } },
    select: { id: true, email: true, name: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  });
  console.log(`\n  Usuarios preservados (${keepUsers.length}):`);
  for (const u of keepUsers) console.log(`  · ${u.name} <${u.email}> [${u.role.name}]`);

  // 5. Reasignación necesaria: clientes preservados cuyo owner está en "a borrar"
  const orphanOwnerClients = keepClients.filter((c) => !keepUserIds.has(c.userId));
  if (orphanOwnerClients.length) {
    console.log(`\n⚠ Clientes preservados que serán reasignados a ${REAL_ADMIN_EMAIL}:`);
    for (const c of orphanOwnerClients) {
      console.log(`  · ${c.name} (antes owner: ${c.userId})`);
    }
  }

  // 6. Reasignación de PMs: si algún proyecto preservado tiene PM que vamos a eliminar, nulificar
  const orphanPmProjects = keepProjects.filter(
    (p) => p.projectManagerId && !keepUserIds.has(p.projectManagerId),
  );
  if (orphanPmProjects.length) {
    console.log(`\n⚠ Proyectos UDD con PM a eliminar (se nulifica projectManagerId):`);
    for (const p of orphanPmProjects) {
      console.log(`  · ${p.name} (antes PM: ${p.projectManagerId})`);
    }
  }

  // 7. Qué se elimina
  const delClients = await prisma.client.findMany({
    where: { id: { notIn: keepClientIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const delClientIds = delClients.map((c) => c.id);

  const delProjects = await prisma.project.findMany({
    where: { clientId: { in: delClientIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const delTestersCount = delClientIds.length
    ? await prisma.tester.count({ where: { project: { clientId: { in: delClientIds } } } })
    : 0;
  const delStoriesCount = delClientIds.length
    ? await prisma.userStory.count({ where: { project: { clientId: { in: delClientIds } } } })
    : 0;
  const delCyclesCount = delClientIds.length
    ? await prisma.testCycle.count({
        where: { story: { project: { clientId: { in: delClientIds } } } },
      })
    : 0;
  const delAssignmentsCount = delClientIds.length
    ? await prisma.testerAssignment.count({
        where: { tester: { project: { clientId: { in: delClientIds } } } },
      })
    : 0;
  const delDailyRecordsCount = delClientIds.length
    ? await prisma.dailyRecord.count({
        where: { tester: { project: { clientId: { in: delClientIds } } } },
      })
    : 0;
  const delActivitiesCount = delClientIds.length
    ? await prisma.activity.count({
        where: { tester: { project: { clientId: { in: delClientIds } } } },
      })
    : 0;

  const delUsers = await prisma.user.findMany({
    where: { id: { notIn: [...keepUserIds] } },
    select: { id: true, email: true, name: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  });
  const delUserIds = delUsers.map((u) => u.id);

  const delDateChangeLogs = delUserIds.length
    ? await prisma.dateChangeLog.count({ where: { userId: { in: delUserIds } } })
    : 0;

  console.log("\nImpacto a eliminar:");
  console.log(`  Clientes:            ${delClients.length}`);
  for (const c of delClients) console.log(`    · ${c.name}`);
  console.log(`  Proyectos (cascade): ${delProjects.length}`);
  for (const p of delProjects) console.log(`    · ${p.name}`);
  console.log(`  Testers (cascade):   ${delTestersCount}`);
  console.log(`  Historias (cascade): ${delStoriesCount}`);
  console.log(`  Ciclos (cascade):    ${delCyclesCount}`);
  console.log(`  Asignaciones (casc): ${delAssignmentsCount}`);
  console.log(`  DailyRecords (casc): ${delDailyRecordsCount}`);
  console.log(`  Activities (casc):   ${delActivitiesCount}`);
  console.log(`  Usuarios:            ${delUsers.length}`);
  for (const u of delUsers) console.log(`    · ${u.name} <${u.email}> [${u.role.name}]`);
  console.log(`  DateChangeLogs:      ${delDateChangeLogs}`);

  if (!CONFIRM) {
    console.log("\n🟡 DRY-RUN — sin cambios. Re-ejecuta con --confirm para eliminar.");
    return;
  }

  console.log("\n🔴 Ejecutando eliminación…");

  await prisma.$transaction(async (tx) => {
    // a) Reasignar UDD a Jose si hace falta
    if (orphanOwnerClients.length) {
      await tx.client.updateMany({
        where: { id: { in: orphanOwnerClients.map((c) => c.id) } },
        data: { userId: realAdmin.id },
      });
      console.log(`  • Reasignados ${orphanOwnerClients.length} clientes UDD a ${REAL_ADMIN_EMAIL}`);
    }

    // b) Nulificar PMs en proyectos UDD si quedan huérfanos
    if (orphanPmProjects.length) {
      await tx.project.updateMany({
        where: { id: { in: orphanPmProjects.map((p) => p.id) } },
        data: { projectManagerId: null },
      });
      console.log(`  • Nulificados PM en ${orphanPmProjects.length} proyectos UDD`);
    }

    // c) Nulificar Tester.userId de UDD si apunta a un usuario a eliminar (raro pero defensivo)
    const orphanTesterLinks = await tx.tester.updateMany({
      where: { projectId: { in: keepProjectIds }, userId: { in: delUserIds } },
      data: { userId: null },
    });
    if (orphanTesterLinks.count > 0) {
      console.log(`  • Nulificados Tester.userId huérfanos en UDD: ${orphanTesterLinks.count}`);
    }

    // d) DateChangeLogs de usuarios a borrar
    if (delUserIds.length) {
      const deleted = await tx.dateChangeLog.deleteMany({ where: { userId: { in: delUserIds } } });
      console.log(`  • DateChangeLogs eliminados: ${deleted.count}`);
    }

    // e) Clientes no preservados → cascade a Project → (Tester, UserStory, Cycle, Assignment, DailyRecord, Activity, etc.)
    if (delClientIds.length) {
      const deleted = await tx.client.deleteMany({ where: { id: { in: delClientIds } } });
      console.log(`  • Clientes eliminados (cascade completo): ${deleted.count}`);
    }

    // f) Usuarios no preservados
    if (delUserIds.length) {
      const deleted = await tx.user.deleteMany({ where: { id: { in: delUserIds } } });
      console.log(`  • Usuarios eliminados: ${deleted.count}`);
    }
  });

  console.log("\n✅ Listo.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
