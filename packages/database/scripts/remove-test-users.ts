/**
 * One-off: elimina usuarios de prueba sembrados por seed.ts que NO deben
 * estar en producción (Ana García, Carolina Díaz, Luis Torres, María
 * Rodríguez, Pedro Sánchez) junto con sus clientes, proyectos, HUs,
 * ciclos, asignaciones, registros diarios, actividades y todo lo
 * cascadeado.
 *
 * Uso:
 *   cd packages/database
 *   npx tsx scripts/remove-test-users.ts          # dry-run (default)
 *   npx tsx scripts/remove-test-users.ts --confirm # elimina de verdad
 *
 * Idempotente: si los usuarios no existen, no hace nada.
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Emails canónicos del seed. Son case-sensitive en DB pero comparamos con ILIKE
// por si algún registro quedó con capitalización distinta.
const TEST_EMAILS = [
  "ana.garcia@qametrics.com",
  "carolina.diaz@qametrics.com",
  "luis.torres@qametrics.com",
  "maria.rodriguez@qametrics.com",
  "pedro.sanchez@qametrics.com",
];

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  console.log("=".repeat(60));
  console.log(`Modo: ${CONFIRM ? "🔴 CONFIRM (elimina)" : "🟡 DRY-RUN (solo audita)"}`);
  console.log("=".repeat(60));

  const users = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS, mode: "insensitive" } },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
  });

  if (users.length === 0) {
    console.log("✓ No se encontraron usuarios de prueba. Nada que hacer.");
    return;
  }

  console.log(`\nUsuarios encontrados (${users.length}):`);
  for (const u of users) {
    console.log(`  - ${u.name} <${u.email}> [rol: ${u.role.name}]`);
  }

  const userIds = users.map((u) => u.id);

  // Clientes de estos usuarios
  const clients = await prisma.client.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, name: true, userId: true },
  });

  // Proyectos de esos clientes
  const clientIds = clients.map((c) => c.id);
  const projects = clientIds.length
    ? await prisma.project.findMany({
        where: { clientId: { in: clientIds } },
        select: { id: true, name: true, clientId: true },
      })
    : [];

  const projectIds = projects.map((p) => p.id);

  // Testers: por tester.userId (analista vinculado) o por tester.projectId (en proyectos a eliminar)
  const testers = await prisma.tester.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        projectIds.length ? { projectId: { in: projectIds } } : { id: "__none__" },
      ],
    },
    select: { id: true, name: true, userId: true, projectId: true },
  });
  const testerIds = testers.map((t) => t.id);

  // Stories en los proyectos a eliminar
  const stories = projectIds.length
    ? await prisma.userStory.count({ where: { projectId: { in: projectIds } } })
    : 0;

  // Ciclos via stories
  const cycles = projectIds.length
    ? await prisma.testCycle.count({ where: { story: { projectId: { in: projectIds } } } })
    : 0;

  // Asignaciones
  const assignments = testerIds.length
    ? await prisma.testerAssignment.count({ where: { testerId: { in: testerIds } } })
    : 0;

  // Registros diarios
  const dailyRecords = testerIds.length
    ? await prisma.dailyRecord.count({ where: { testerId: { in: testerIds } } })
    : 0;

  // Actividades
  const activities = testerIds.length
    ? await prisma.activity.count({ where: { testerId: { in: testerIds } } })
    : 0;

  // DateChangeLogs donde alguno de estos usuarios fue el actor
  const dateChangeLogs = await prisma.dateChangeLog.count({
    where: { userId: { in: userIds } },
  });

  // Proyectos de los que alguno sea projectManager (fuera de los clientes a eliminar)
  const otherPmProjects = await prisma.project.findMany({
    where: {
      projectManagerId: { in: userIds },
      ...(clientIds.length ? { NOT: { clientId: { in: clientIds } } } : {}),
    },
    select: { id: true, name: true, projectManagerId: true },
  });

  // Testers con userId = uno de estos, pero cuyo proyecto NO vamos a eliminar
  const externalTesters = testers.filter(
    (t) => t.userId && userIds.includes(t.userId) && !projectIds.includes(t.projectId),
  );

  console.log("\nImpacto a eliminar:");
  console.log(`  Clientes:              ${clients.length}`);
  for (const c of clients) console.log(`    · ${c.name}`);
  console.log(`  Proyectos (cascade):   ${projects.length}`);
  for (const p of projects) console.log(`    · ${p.name}`);
  console.log(`  Testers:               ${testers.length}`);
  console.log(`  Historias (cascade):   ${stories}`);
  console.log(`  Ciclos (cascade):      ${cycles}`);
  console.log(`  Asignaciones (casc):   ${assignments}`);
  console.log(`  DailyRecords (casc):   ${dailyRecords}`);
  console.log(`  Activities (casc):     ${activities}`);
  console.log(`  DateChangeLogs:        ${dateChangeLogs}`);

  const blockers: string[] = [];
  if (otherPmProjects.length) {
    blockers.push(
      `Algún usuario es projectManager de proyectos que NO se van a borrar:\n` +
        otherPmProjects.map((p) => `    · ${p.name} (PM: ${p.projectManagerId})`).join("\n"),
    );
  }
  if (externalTesters.length) {
    blockers.push(
      `Hay testers vinculados por userId a proyectos que NO se borran:\n` +
        externalTesters
          .map((t) => `    · tester ${t.name} en proyecto ${t.projectId}`)
          .join("\n"),
    );
  }
  if (blockers.length) {
    console.log("\n⚠ Bloqueadores (resolver antes de eliminar):");
    for (const b of blockers) console.log(`  - ${b}`);
    console.log(
      "\nSe requerirá nulificar `projectManagerId` / `tester.userId` en esos registros antes de borrar al User.",
    );
  }

  if (!CONFIRM) {
    console.log("\n🟡 DRY-RUN — sin cambios. Re-ejecuta con --confirm para eliminar.");
    return;
  }

  console.log("\n🔴 Ejecutando eliminación…");

  await prisma.$transaction(async (tx) => {
    // Nulificar referencias externas si las hubiera
    if (otherPmProjects.length) {
      await tx.project.updateMany({
        where: { id: { in: otherPmProjects.map((p) => p.id) } },
        data: { projectManagerId: null },
      });
      console.log(`  • nulificados projectManagerId de ${otherPmProjects.length} proyectos externos`);
    }
    if (externalTesters.length) {
      await tx.tester.updateMany({
        where: { id: { in: externalTesters.map((t) => t.id) } },
        data: { userId: null },
      });
      console.log(`  • nulificados userId de ${externalTesters.length} testers externos`);
    }

    // DateChangeLogs donde el actor es uno de estos users
    if (dateChangeLogs > 0) {
      const deleted = await tx.dateChangeLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  • DateChangeLogs eliminados: ${deleted.count}`);
    }

    // Clientes → cascade elimina Project → (Tester, UserStory, TestCycle, Assignment, DailyRecord, Activity, etc.)
    if (clientIds.length) {
      const deleted = await tx.client.deleteMany({ where: { id: { in: clientIds } } });
      console.log(`  • Clientes eliminados (cascade proyectos/HUs/etc): ${deleted.count}`);
    }

    // Por si quedaron Testers externos (no deberían porque ya nulificamos userId)
    // no eliminamos esos testers: siguen siendo válidos con userId=null.

    // Usuarios
    const deletedUsers = await tx.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`  • Usuarios eliminados: ${deletedUsers.count}`);
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
