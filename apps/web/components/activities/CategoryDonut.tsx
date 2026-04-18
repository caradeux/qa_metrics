"use client";
import type { OccupationRow } from "@/lib/api-client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard, CustomTooltip, CHART_ICONS } from "@/components/reports/chart-primitives";

const PRODUCTIVE_COLOR = "#2E5FA3";
const FALLBACK_PALETTE = ["#7c3aed", "#ea580c", "#db2777", "#0d9488", "#f59e0b", "#475569"];

interface Slice {
  name: string;
  value: number;
  color: string;
}

export function CategoryDonut({ rows }: { rows: OccupationRow[] }) {
  const categoryTotals = new Map<string, { hours: number; color: string | null }>();
  let fallbackIdx = 0;
  let productive = 0;

  for (const row of rows) {
    productive += row.productiveHoursEstimate;
    for (const c of row.byCategory) {
      const existing = categoryTotals.get(c.name);
      categoryTotals.set(c.name, {
        hours: (existing?.hours ?? 0) + c.hours,
        color: existing?.color ?? c.color,
      });
    }
  }

  const slices: Slice[] = [
    { name: "Productivo estimado", value: Number(productive.toFixed(1)), color: PRODUCTIVE_COLOR },
    ...[...categoryTotals.entries()].map(([name, { hours, color }]) => ({
      name,
      value: Number(hours.toFixed(1)),
      color: color ?? FALLBACK_PALETTE[fallbackIdx++ % FALLBACK_PALETTE.length],
    })),
  ].filter((s) => s.value > 0);

  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <ChartCard
      title="Distribución global"
      subtitle="Horas totales del equipo por categoría en el período"
      icon={CHART_ICONS.pie}
    >
      {total === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
          Sin datos en el período seleccionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip unit=" h" />} />
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingLeft: 16 }}
              formatter={(value: string) => {
                const s = slices.find((x) => x.name === value);
                const pct = s && total ? Math.round((s.value / total) * 100) : 0;
                return (
                  <span className="text-gray-700">
                    {value} <span className="text-gray-400">· {pct}%</span>
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
