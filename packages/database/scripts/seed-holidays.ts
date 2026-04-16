import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { HOLIDAYS_CL_2026 } from "../src/holidays-cl-2026.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  let count = 0;
  for (const h of HOLIDAYS_CL_2026) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: { name: h.name },
      create: { date: new Date(h.date), name: h.name },
    });
    count++;
  }
  console.log(`OK: ${count} feriados CL 2026 asegurados (upsert).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
