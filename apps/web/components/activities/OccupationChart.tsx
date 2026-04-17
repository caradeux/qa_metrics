"use client";
import type { OccupationRow } from "@/lib/api-client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function OccupationChart({ rows }: { rows: OccupationRow[] }) {
  const categoryColors = new Map<string, string>();
  for (const row of rows) {
    for (const c of row.byCategory) {
      if (c.color) categoryColors.set(c.name, c.color);
    }
  }
  const categoryNames = [...categoryColors.keys()];

  const data = rows.map((r) => {
    const d: Record<string, any> = { tester: r.testerName, Productivo: r.productiveHoursEstimate };
    for (const c of r.byCategory) d[c.name] = c.hours;
    return d;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="tester" />
        <YAxis label={{ value: "horas", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Productivo" stackId="a" fill="#9FBFE5" />
        {categoryNames.map((n) => (
          <Bar key={n} dataKey={n} stackId="a" fill={categoryColors.get(n) ?? "#888"} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
