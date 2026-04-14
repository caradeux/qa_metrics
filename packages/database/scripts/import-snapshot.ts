import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Import script idempotente.
 * Uso:  npx tsx scripts/import-snapshot.ts [ruta-al-snapshot.json]
 * Si no se pasa argumento, usa deploy/snapshots/snapshot-latest.json.
 *
 * Estrategia: upsert por id (conserva IDs originales). Respeta orden de FKs.
 */
async function main() {
  const argFile = process.argv[2];
  const file = argFile
    ? path.resolve(argFile)
    : path.resolve(process.cwd(), "../../deploy/snapshots/snapshot-latest.json");

  if (!fs.existsSync(file)) {
    throw new Error(`Snapshot no encontrado: ${file}`);
  }

  console.log(`Leyendo snapshot: ${file}`);
  const snap: any = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`Generado: ${snap.generatedAt}`);

  // Helpers
  async function upsertAll<T extends { id: string }>(name: string, rows: T[], fn: (r: T) => Promise<unknown>) {
    if (!rows?.length) {
      console.log(`  ${name}: (vacío)`);
      return;
    }
    let ok = 0;
    let err = 0;
    for (const r of rows) {
      try {
        await fn(r);
        ok++;
      } catch (e) {
        err++;
        console.error(`  ERROR ${name} id=${r.id}:`, (e as Error).message);
      }
    }
    console.log(`  ${name}: ${ok} ok, ${err} err`);
  }

  // 1) permissions
  await upsertAll("permissions", snap.permissions ?? [], (p: any) =>
    prisma.permission.upsert({ where: { id: p.id }, update: p, create: p })
  );

  // 2) roles
  await upsertAll("roles", snap.roles ?? [], (r: any) =>
    prisma.role.upsert({ where: { id: r.id }, update: r, create: r })
  );

  // 3) rolePermissions
  await upsertAll("rolePermissions", snap.rolePermissions ?? [], (rp: any) =>
    prisma.rolePermission.upsert({ where: { id: rp.id }, update: rp, create: rp })
  );

  // 4) users
  await upsertAll("users", snap.users ?? [], (u: any) =>
    prisma.user.upsert({ where: { id: u.id }, update: u, create: u })
  );

  // 5) clients
  await upsertAll("clients", snap.clients ?? [], (c: any) =>
    prisma.client.upsert({ where: { id: c.id }, update: c, create: c })
  );

  // 6) projects
  await upsertAll("projects", snap.projects ?? [], (p: any) =>
    prisma.project.upsert({ where: { id: p.id }, update: p, create: p })
  );

  // 7) testers
  await upsertAll("testers", snap.testers ?? [], (t: any) =>
    prisma.tester.upsert({ where: { id: t.id }, update: t, create: t })
  );

  // 8) testCycles
  await upsertAll("testCycles", snap.testCycles ?? [], (c: any) =>
    prisma.testCycle.upsert({ where: { id: c.id }, update: c, create: c })
  );

  // 9) userStories
  await upsertAll("userStories", snap.userStories ?? [], (s: any) =>
    prisma.userStory.upsert({ where: { id: s.id }, update: s, create: s })
  );

  // 10) testerAssignments
  await upsertAll("testerAssignments", snap.testerAssignments ?? [], (a: any) =>
    prisma.testerAssignment.upsert({ where: { id: a.id }, update: a, create: a })
  );

  // 11) assignmentStatusLogs
  await upsertAll("assignmentStatusLogs", snap.assignmentStatusLogs ?? [], (l: any) =>
    prisma.assignmentStatusLog.upsert({ where: { id: l.id }, update: l, create: l })
  );

  // 12) assignmentPhases
  await upsertAll("assignmentPhases", snap.assignmentPhases ?? [], (p: any) =>
    prisma.assignmentPhase.upsert({ where: { id: p.id }, update: p, create: p })
  );

  // 13) dailyRecords
  await upsertAll("dailyRecords", snap.dailyRecords ?? [], (d: any) =>
    prisma.dailyRecord.upsert({ where: { id: d.id }, update: d, create: d })
  );

  // 14) holidays
  await upsertAll("holidays", snap.holidays ?? [], (h: any) =>
    prisma.holiday.upsert({ where: { id: h.id }, update: h, create: h })
  );

  console.log("Import completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
