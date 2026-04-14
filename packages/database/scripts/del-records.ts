import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const before = await prisma.dailyRecord.count();
const r = await prisma.dailyRecord.deleteMany({});
console.log(`Borrados ${r.count} DailyRecords (antes: ${before})`);
await prisma.$disconnect();
