"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WeeklyTrendData {
  weekStart: string;
  designed: number;
  executed: number;
  defects: number;
}

interface WeeklyTrendChartProps {
  data: WeeklyTrendData[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const formatted = new Date(label).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
  return (
    <div className="rounded-lg bg-[#1F3864] px-4 py-3 text-white shadow-xl border-none">
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-white/60">
        {formatted}
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

function formatXTick(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatXTick}
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

        <Line
          type="monotone"
          dataKey="designed"
          name="Diseñados"
          stroke="#1F3864"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: "#1F3864" }}
        />
        <Line
          type="monotone"
          dataKey="executed"
          name="Ejecutados"
          stroke="#4A90D9"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: "#4A90D9" }}
        />
        <Line
          type="monotone"
          dataKey="defects"
          name="Defectos"
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: "#ef4444" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
