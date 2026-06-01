export function roundToStep(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

export interface WeightedItem { key: string; weight: number; }

export function distributeHours(
  items: WeightedItem[], total: number, step = 0.5,
): Map<string, number> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;

  const target = roundToStep(Math.max(0, total), step);
  if (target <= 0) {
    for (const it of items) out.set(it.key, 0);
    return out;
  }

  const totalWeight = items.reduce((s, it) => s + Math.max(0, it.weight), 0);
  const shares = items.map((it) => {
    const frac = totalWeight > 0 ? Math.max(0, it.weight) / totalWeight : 1 / items.length;
    return { key: it.key, raw: target * frac };
  });

  let assigned = 0;
  for (const s of shares) {
    const r = roundToStep(s.raw, step);
    out.set(s.key, r);
    assigned += r;
  }

  let residual = roundToStep(target - assigned, step);
  const order = [...shares].sort((a, b) => b.raw - a.raw);
  let i = 0;
  while (Math.abs(residual) >= step - 1e-9 && order.length > 0) {
    const key = order[i % order.length]!.key;
    const cur = out.get(key)!;
    const next = residual > 0 ? cur + step : Math.max(0, cur - step);
    if (next !== cur) { out.set(key, next); residual = roundToStep(residual - (next - cur), step); }
    i++;
    if (i > 10000) break;
  }
  return out;
}
