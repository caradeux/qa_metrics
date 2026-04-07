"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CycleComparisonProps {
  data: Array<{
    cycleName: string;
    totalDesigned: number;
    totalExecuted: number;
    totalDefects: number;
    executionRatio: number;
  }>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#1F3864] px-4 py-3 text-white shadow-xl border-none">
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-white/60">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/80">{entry.name}:</span>
          <span className="font-mono font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-end gap-5 pb-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CycleComparison({ data }: CycleComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#f0f0f0"
          vertical={false}
        />
        <XAxis
          dataKey="cycleName"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} verticalAlign="top" align="right" />

        <Bar
          dataKey="totalDesigned"
          name="Diseñados"
          fill="#1F3864"
          barSize={14}
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="totalExecuted"
          name="Ejecutados"
          fill="#4A90D9"
          barSize={14}
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="totalDefects"
          name="Defectos"
          fill="#ef4444"
          barSize={14}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
