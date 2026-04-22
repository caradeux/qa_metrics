/**
 * Asigna colores únicos de paleta a categorías de actividad que:
 *  (a) no tienen color (null), o
 *  (b) tienen un color neutro (gris/negro/blanco) de placeholder, o
 *  (c) comparten color con otra categoría (duplicado) — se mantiene la más
 *      antigua y las demás se reasignan.
 *
 * Idempotente: correrlo dos veces no cambia nada en la segunda corrida
 * (salvo creación de nuevas categorías entre medio).
 *
 * Uso en prod (terminal del contenedor qa-metrics-api vía Coolify):
 *   cd /app/packages/database
 *   npx tsx scripts/backfill-category-colors.ts
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
];

const NEUTRAL_COLORS = new Set(["#888888", "#000000", "#FFFFFF", "#CCCCCC", "#999999"]);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const all = await prisma.activityCategory.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true },
  });

  const keepersByColor = new Map<string, string>();
  const toReassign: typeof all = [];
  for (const cat of all) {
    const k = (cat.color ?? "").toUpperCase();
    if (!k || NEUTRAL_COLORS.has(k)) { toReassign.push(cat); continue; }
    if (!keepersByColor.has(k)) {
      keepersByColor.set(k, cat.id);
    } else {
      toReassign.push(cat);
    }
  }

  if (toReassign.length === 0) {
    console.log(`Todas las categorías (${all.length}) tienen colores únicos — nada que hacer.`);
    return;
  }

  console.log(`Total categorías: ${all.length}`);
  console.log(`Con color único conservado: ${keepersByColor.size}`);
  console.log(`A reasignar: ${toReassign.length}\n`);

  const committed = new Set(keepersByColor.keys());
  const queue = PALETTE.filter((c) => !committed.has(c.toUpperCase()));
  let fallbackIdx = 0;

  for (const cat of toReassign) {
    const color = queue.shift() ?? PALETTE[fallbackIdx++ % PALETTE.length]!;
    committed.add(color.toUpperCase());
    await prisma.activityCategory.update({
      where: { id: cat.id },
      data: { color },
    });
    console.log(`  ${cat.name.padEnd(40)} ${(cat.color ?? "(null)").padEnd(10)} → ${color}`);
  }

  console.log(`\n✓ ${toReassign.length} categorías actualizadas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
