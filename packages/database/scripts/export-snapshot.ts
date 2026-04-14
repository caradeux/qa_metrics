import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const snapshot: Record<string, unknown> = {};
  snapshot.generatedAt = new Date().toISOString();
  snapshot.schemaVersion = "1.0.0";

  // Orden por dependencias (se exporta plano; el import respeta el orden)
  snapshot.permissions = await prisma.permission.findMany();
  snapshot.roles = await prisma.role.findMany();
  snapshot.rolePermissions = await prisma.rolePermission.findMany();
  snapshot.users = await prisma.user.findMany();
  snapshot.clients = await prisma.client.findMany();
  snapshot.projects = await prisma.project.findMany();
  snapshot.testers = await prisma.tester.findMany();
  snapshot.testCycles = await prisma.testCycle.findMany();
  snapshot.userStories = await prisma.userStory.findMany();
  snapshot.testerAssignments = await prisma.testerAssignment.findMany();
  snapshot.assignmentStatusLogs = await prisma.assignmentStatusLog.findMany();
  snapshot.assignmentPhases = await prisma.assignmentPhase.findMany();
  snapshot.dailyRecords = await prisma.dailyRecord.findMany();
  snapshot.holidays = await prisma.holiday.findMany();

  const outDir = path.resolve(process.cwd(), "../../deploy/snapshots");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `snapshot-${stamp}.json`);
  const latest = path.join(outDir, `snapshot-latest.json`);

  const json = JSON.stringify(
    snapshot,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
  fs.writeFileSync(file, json);
  fs.writeFileSync(latest, json);

  const sizeKb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`Snapshot escrito: ${file} (${sizeKb} KB)`);
  console.log(`También: ${latest}`);
  console.log("Conteos:");
  for (const [k, v] of Object.entries(snapshot)) {
    if (Array.isArray(v)) console.log(`  ${k}: ${v.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
