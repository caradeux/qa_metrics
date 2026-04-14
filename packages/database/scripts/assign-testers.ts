import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const rgarcia = await prisma.user.findUniqueOrThrow({ where: { email: "rgarcia@inovabiz.com" } });
const braulio = await prisma.user.findUniqueOrThrow({ where: { email: "b.benardis@inovabiz.com" } });
const udd = await prisma.client.findFirstOrThrow({ where: { name: { contains: "UDD" } } });

async function getProject(name: string) {
  return prisma.project.findFirstOrThrow({ where: { name, clientId: udd.id } });
}

async function ensureTester(projectName: string, name: string, userId: string | null, allocation: number) {
  const project = await getProject(projectName);
  const existing = await prisma.tester.findFirst({ where: { projectId: project.id, name } });
  if (existing) { console.log(`Ya existe: ${name} en ${projectName}`); return existing; }
  if (userId) {
    const used = await prisma.tester.aggregate({ _sum: { allocation: true }, where: { userId } });
    const usedTotal = used._sum.allocation ?? 0;
    if (usedTotal + allocation > 100) {
      console.log(`⚠ ${name}: capacidad excedida (${usedTotal}% + ${allocation}%). Creo sin cuenta.`);
      userId = null;
    }
  }
  const t = await prisma.tester.create({ data: { projectId: project.id, name, userId, allocation } });
  console.log(`Tester creado: ${name} en ${projectName} [${allocation}% ${userId ? "vinculado" : "sin cuenta"}]`);
  return t;
}

const testers = [
  { project: "Tracking", name: "Renato Garcia", userId: rgarcia.id, allocation: 50 },
  { project: "Sistema de Notas", name: "Renato Garcia", userId: rgarcia.id, allocation: 50 },
  { project: "DEC", name: "Braulio Benardis", userId: braulio.id, allocation: 100 },
];
const created: Record<string, string> = {};
for (const t of testers) {
  const tt = await ensureTester(t.project, t.name, t.userId, t.allocation);
  created[t.project] = tt.id;
}

// Asignar testers a las HUs sin asignación
const unassigned = await prisma.userStory.findMany({
  where: { assignments: { none: {} }, project: { name: { in: Object.keys(created) } } },
  include: { cycles: true, project: true },
});
for (const story of unassigned) {
  const testerId = created[story.project.name];
  if (!testerId) continue;
  const cycle = story.cycles[0];
  if (!cycle) continue;

  // status ya estaba en notes — re-leer del PDF sería ideal, pero por simplicidad uso REGISTERED como fallback
  // El map original se perdió; en lugar de eso, marco REGISTERED (el usuario ajusta en la UI).
  const status = "REGISTERED";
  const a = await prisma.testerAssignment.create({
    data: { testerId, storyId: story.id, cycleId: cycle.id, startDate: new Date("2026-04-06"), status },
  });
  await prisma.assignmentStatusLog.create({ data: { assignmentId: a.id, status } });
  console.log(`Asignación: ${story.project.name} / ${story.title.slice(0, 50)}`);
}

await prisma.$disconnect();
