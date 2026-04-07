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

interface CaseTypeDistributionProps {
  data: {
    functional: { designed: number; executed: number };
    regression: { designed: number; executed: number };
    smoke: { designed: number; executed: number };
    exploratory: { designed: number; executed: number };
  };
}

const TYPE_LABELS: Record<string, string> = {
  functional: "Funcional",
  regression: "Regresión",
  smoke: "Smoke",
  exploratory: "Exploratorio",
};

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

export default function CaseTypeDistribution({
  data,
}: CaseTypeDistributionProps) {
  const chartData = Object.entries(data).map(([key, val]) => ({
    name: TYPE_LABELS[key] || key,
    designed: val.designed,
    executed: val.executed,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#f0f0f0"
          vertical={false}
        />
        <XAxis
          dataKey="name"
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
          dataKey="designed"
          name="Diseñados"
          fill="#1F3864"
          barSize={16}
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="executed"
          name="Ejecutados"
          fill="#4A90D9"
          barSize={16}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
