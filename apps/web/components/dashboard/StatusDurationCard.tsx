"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { statusMap } from "@/components/stories/StatusBadge";

interface StatusRow {
  status: string;
  avgDays: number;
  p50Days: number;
  p90Days: number;
  totalDays: number;
  entries: number;
}

interface Response {
  scope: "project" | "global";
  projectId: string | null;
  assignmentsCount: number;
  statuses: StatusRow[];
}

interface Props {
  projectId?: string;
  title?: string;
  subtitle?: string;
}

export function StatusDurationCard({ projectId, title, subtitle }: Props) {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    apiClient<Response>(`/api/metrics/status-duration${qs}`)
      .then(setData)
      .catch((e: any) => setError(e?.message ?? "Error"));
  }, [projectId]);

  if (error) return <div className="rounded-lg border bg-white p-4 text-sm text-red-600 shadow-sm">Lead time por estado: {error}</div>;
  if (!data) return <div className="h-40 animate-shimmer rounded-lg" />;

  const maxAvg = Math.max(1, ...data.statuses.map((s) => s.avgDays));

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp" style={{ borderTop: "3px solid #0891b2" }}>
      <div className="p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium">
            {title ?? "Lead Time por Estado"}
          </h3>
          <span className="text-[11px] text-gray-400">
            {data.assignmentsCount} asignación{data.assignmentsCount === 1 ? "" : "es"} · {data.scope === "global" ? "todos los proyectos" : "este proyecto"}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          {subtitle ?? "Días promedio que una HU permanece en cada estado. Valores altos indican cuellos de botella."}
        </p>

        {data.statuses.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Sin historial de cambios de estado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-2 py-1.5 text-left font-medium">Estado</th>
                  <th className="px-2 py-1.5 text-left font-medium">Distribución (promedio)</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Promedio en días">Promedio</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Mediana (p50)">p50</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Percentil 90">p90</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Cantidad de tramos medidos en este estado">Muestras</th>
                </tr>
              </thead>
              <tbody>
                {data.statuses.map((row, idx) => {
                  const meta = statusMap[row.status];
                  const color = meta?.color ?? "#6b7280";
                  const label = meta?.label ?? row.status;
                  const pct = Math.min(100, (row.avgDays / maxAvg) * 100);
                  const bottleneck = row.avgDays >= 5;
                  return (
                    <tr key={row.status} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {label}
                        </span>
                      </td>
                      <td className="px-2 py-2 w-1/3">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${bottleneck ? "text-red-600 font-bold" : "text-gray-800"}`} title={bottleneck ? "Posible cuello de botella" : undefined}>
                        {row.avgDays} d
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-600">{row.p50Days} d</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-600">{row.p90Days} d</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-400">{row.entries}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-gray-400">
              El estado <span className="font-semibold">PRODUCTION</span> no se cuenta como tiempo acumulado (terminal). Tramos con promedio ≥ 5 días se resaltan como posibles cuellos de botella.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
