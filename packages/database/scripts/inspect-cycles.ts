import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new (await import("@prisma/adapter-pg")).PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const counts = {
  cycles: await prisma.testCycle.count(),
  assignments: await prisma.testerAssignment.count(),
  dailyRecords: await prisma.dailyRecord.count(),
  breakdowns: await prisma.cycleBreakdown.count(),
  stories: await prisma.userStory.count(),
  projects: await prisma.project.count(),
};
console.log(counts);
await prisma.$disconnect();
