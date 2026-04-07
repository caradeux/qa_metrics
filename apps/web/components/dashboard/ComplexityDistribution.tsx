"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface ComplexityDistributionProps {
  data: {
    high: number;
    medium: number;
    low: number;
  };
}

const COMPLEXITY_CONFIG = [
  { key: "high", label: "Alta", color: "#ef4444" },
  { key: "medium", label: "Media", color: "#f59e0b" },
  { key: "low", label: "Baja", color: "#10b981" },
] as const;

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg bg-[#1F3864] px-3.5 py-2.5 text-white shadow-xl border-none">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: entry.payload.fill }}
        />
        <span className="text-white/80">{entry.name}:</span>
        <span className="font-mono font-semibold">{entry.value}</span>
      </div>
    </div>
  );
}

export default function ComplexityDistribution({
  data,
}: ComplexityDistributionProps) {
  const chartData = COMPLEXITY_CONFIG.map((c) => ({
    name: c.label,
    value: data[c.key],
    fill: c.color,
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold text-gray-800">
            {total}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="text-[11px] text-gray-500">{entry.name}</span>
            <span className="font-mono text-[11px] font-semibold text-gray-700">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
