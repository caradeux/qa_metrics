import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const projects = await prisma.project.findMany({ include: { stories: { include: { assignments: true, cycles: true } } } });
for (const p of projects) {
  const assigned = p.stories.filter(s => s.assignments.length > 0).length;
  console.log(`${p.name}: ${p.stories.length} HUs | ${assigned} con asignación | ${p.stories.reduce((n,s)=>n+s.cycles.length,0)} ciclos`);
}
await prisma.$disconnect();
