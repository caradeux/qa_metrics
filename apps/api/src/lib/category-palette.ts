import { prisma } from "@qa-metrics/database";

/**
 * Paleta fija de 16 tonos distinguibles para categorías de actividad.
 * Los valores son hex uppercase para comparar sin sensibilidad a mayúsculas.
 */
export const CATEGORY_PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
] as const;

/**
 * Devuelve el primer color de la paleta que no esté en uso por otra
 * categoría. Si todos están usados, rota por `fallbackIndex` (determinístico)
 * o, si no se provee, devuelve uno al azar. Comparación case-insensitive.
 */
export async function pickUnusedCategoryColor(fallbackIndex?: number): Promise<string> {
  const used = await prisma.activityCategory.findMany({
    where: { color: { not: null } },
    select: { color: true },
  });
  const usedSet = new Set(
    used.map((c) => (c.color ?? "").toUpperCase()).filter(Boolean)
  );
  for (const c of CATEGORY_PALETTE) {
    if (!usedSet.has(c)) return c;
  }
  const idx = typeof fallbackIndex === "number"
    ? ((fallbackIndex % CATEGORY_PALETTE.length) + CATEGORY_PALETTE.length) % CATEGORY_PALETTE.length
    : Math.floor(Math.random() * CATEGORY_PALETTE.length);
  return CATEGORY_PALETTE[idx]!;
}
