"use client";
import type { OccupationRow } from "@/lib/api-client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, CustomTooltip, CHART_ICONS } from "@/components/reports/chart-primitives";

const PRODUCTIVE_COLOR = "#2E5FA3";
const PRODUCTIVE_GRADIENT = ["#2E5FA3", "#1F3864"];
const FALLBACK_PALETTE = ["#7c3aed", "#ea580c", "#db2777", "#0d9488", "#f59e0b", "#475569"];

function shade(hex: string, amount: number) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const nums = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].map((n) =>
    Math.max(0, Math.min(255, Math.round(n + amount))),
  );
  return `#${nums.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function OccupationChart({ rows }: { rows: OccupationRow[] }) {
  const categoryColors = new Map<string, string>();
  let fallbackIdx = 0;
  for (const row of rows) {
    for (const c of row.byCategory) {
      if (!categoryColors.has(c.name)) {
        categoryColors.set(c.name, c.color ?? FALLBACK_PALETTE[fallbackIdx++ % FALLBACK_PALETTE.length]);
      }
    }
  }
  const categoryNames = [...categoryColors.keys()];

  const data = rows.map((r) => {
    const d: Record<string, any> = {
      tester: r.testerName,
      Productivo: Number(r.productiveHoursEstimate.toFixed(1)),
    };
    for (const c of r.byCategory) d[c.name] = Number(c.hours.toFixed(1));
    return d;
  });

  return (
    <ChartCard
      title="Distribución de horas por tester"
      subtitle="Horas productivas estimadas vs. horas dedicadas a actividades"
      icon={CHART_ICONS.activity}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-productive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRODUCTIVE_GRADIENT[0]} stopOpacity={0.95} />
              <stop offset="100%" stopColor={PRODUCTIVE_GRADIENT[1]} stopOpacity={0.75} />
            </linearGradient>
            {categoryNames.map((name) => {
              const base = categoryColors.get(name)!;
              const id = `grad-cat-${name.replace(/\W+/g, "_")}`;
              return (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={base} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={shade(base, -30)} stopOpacity={0.8} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="tester"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            label={{ value: "horas", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip unit=" h" />} cursor={{ fill: "#1F386410" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar
            dataKey="Productivo"
            stackId="a"
            fill="url(#grad-productive)"
            name="Productivo estimado"
            radius={[0, 0, 0, 0]}
          />
          {categoryNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="a"
              fill={`url(#grad-cat-${name.replace(/\W+/g, "_")})`}
              radius={i === categoryNames.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
