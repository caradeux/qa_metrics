"use client";
import type { OccupationRow } from "@/lib/api-client";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CustomTooltip, CHART_ICONS } from "@/components/reports/chart-primitives";

function colorForOccupation(pct: number): string {
  if (pct > 100) return "#dc2626";
  if (pct >= 60 && pct <= 90) return "#16a34a";
  return "#f59e0b";
}

export function OccupationBarHorizontal({ rows }: { rows: OccupationRow[] }) {
  const data = [...rows]
    .map((r) => ({
      tester: r.testerName,
      Ocupación: Math.round(r.occupationPct),
      _fill: colorForOccupation(r.occupationPct),
    }))
    .sort((a, b) => b["Ocupación"] - a["Ocupación"]);

  const height = Math.max(180, data.length * 34 + 40);

  return (
    <ChartCard
      title="Ocupación por tester"
      subtitle="Verde 60–90% · Ámbar <60% o 90–100% · Rojo >100% (sobrecarga)"
      icon={CHART_ICONS.gauge}
    >
      {data.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">
          Sin testers en el período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 40, left: 8, bottom: 0 }}>
            <XAxis
              type="number"
              domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="tester"
              stroke="#374151"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip content={<CustomTooltip unit="%" />} cursor={{ fill: "#1F386408" }} />
            <ReferenceLine
              x={100}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{ value: "100%", position: "top", fontSize: 10, fill: "#dc2626" }}
            />
            <Bar
              dataKey="Ocupación"
              radius={[0, 6, 6, 0]}
              label={{
                position: "right",
                formatter: (v: any) => `${v}%`,
                fontSize: 11,
                fill: "#374151",
                fontWeight: 600,
              }}
            >
              {data.map((d) => (
                <Cell key={d.tester} fill={d._fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
