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
import type { AutomationWeekMetric } from "@/lib/api-client";

type LineDef = { dataKey: keyof AutomationWeekMetric; name: string; color: string; dashed?: boolean };

function formatXTick(value: string) {
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const formatted = new Date(label + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return (
    <div className="rounded-lg bg-[#1F3864] px-4 py-3 text-white shadow-xl border-none">
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-white/60">Semana del {formatted}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white/80">{entry.name}:</span>
          <span className="font-mono font-semibold">{entry.value}{unit ?? ""}</span>
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
          <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[11px] text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AutomationTrendChart({
  data,
  lines,
  unit,
  domain,
}: {
  data: AutomationWeekMetric[];
  lines: LineDef[];
  unit?: string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" />
        <XAxis dataKey="weekStart" tickFormatter={formatXTick} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={domain} />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Legend content={<CustomLegend />} verticalAlign="top" align="right" />
        {lines.map((l) => (
          <Line
            key={String(l.dataKey)}
            type="monotone"
            dataKey={l.dataKey as string}
            name={l.name}
            stroke={l.color}
            strokeWidth={2.25}
            strokeDasharray={l.dashed ? "4 2" : undefined}
            dot={false}
            activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: l.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
