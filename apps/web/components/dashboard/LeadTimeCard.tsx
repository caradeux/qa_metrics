"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface LeadTimeStory {
  storyId: string;
  externalId: string | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  leadTimeDays: number | null;
  status: "CLOSED" | "OPEN" | "NOT_STARTED";
}

interface LeadTimeResponse {
  projectId: string;
  totals: { total: number; closed: number; open: number; notStarted: number };
  aggregates: {
    p50: number | null;
    p90: number | null;
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  stories: LeadTimeStory[];
}

function fmt(n: number | null): string {
  return n === null || n === undefined ? "—" : `${n} d`;
}

const STATUS_LABEL: Record<string, string> = {
  CLOSED: "Cerrada",
  OPEN: "Abierta",
  NOT_STARTED: "No iniciada",
};

const STATUS_STYLE: Record<string, string> = {
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  NOT_STARTED: "bg-gray-50 text-gray-500 border-gray-200",
};

export function LeadTimeCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<LeadTimeResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<LeadTimeResponse>(`/api/metrics/projects/${projectId}/lead-time`)
      .then(setData)
      .catch((e: any) => setError(e?.message ?? "Error"));
  }, [projectId]);

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-red-600 shadow-sm">
        Lead time: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="h-40 animate-shimmer rounded-lg" />;
  }

  const kpis = [
    { label: "Mediana (p50)", value: data.aggregates.p50, accent: "#2E5FA3", hint: "50% de las HUs cerradas se completan en este tiempo o menos." },
    { label: "Percentil 90 (p90)", value: data.aggregates.p90, accent: "#7c3aed", hint: "El 90% de las HUs cerradas se completan en este tiempo o menos. Útil para proyecciones conservadoras." },
    { label: "Promedio", value: data.aggregates.avg, accent: "#0891b2", hint: "Promedio aritmético de los tiempos de cierre." },
    { label: "Peor caso", value: data.aggregates.max, accent: "#dc2626", hint: "La HU cerrada que más tardó." },
  ];

  const top = [...data.stories].filter((s) => s.leadTimeDays !== null).slice(0, 8);

  return (
    <div
      className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
      style={{ borderTop: "3px solid #7c3aed" }}
    >
      <div className="p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium">
              Lead Time por HU
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Días desde la primera asignación hasta alcanzar <span className="font-semibold">Producción</span>.
            </p>
          </div>
          <div className="text-[11px] text-gray-400">
            {data.totals.closed} cerrada{data.totals.closed === 1 ? "" : "s"} · {data.totals.open} abierta{data.totals.open === 1 ? "" : "s"}
            {data.totals.notStarted > 0 && ` · ${data.totals.notStarted} sin iniciar`}
          </div>
        </div>

        {data.totals.closed === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Aún no hay HUs cerradas (en Producción) para calcular métricas. Se mostrarán cuando una HU alcance ese estado.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                title={k.hint}
                className="rounded-lg border border-gray-100 bg-gradient-to-br from-white to-gray-50/50 p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  {k.label}
                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </p>
                <p className="font-mono text-2xl font-bold tabular-nums mt-1" style={{ color: k.accent }}>
                  {fmt(k.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {top.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold text-[#2E5FA3] hover:underline"
            >
              {expanded ? "Ocultar" : "Ver"} detalle por HU ({top.length}
              {data.stories.length > top.length ? `/${data.stories.length}` : ""})
            </button>
            {expanded && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="px-2 py-1.5 text-left font-medium">HU</th>
                      <th className="px-2 py-1.5 text-left font-medium">Estado</th>
                      <th className="px-2 py-1.5 text-right font-medium">Lead time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expanded ? data.stories.filter((s) => s.leadTimeDays !== null) : top).map((s, idx) => (
                      <tr key={s.storyId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                        <td className="px-2 py-1.5">
                          {s.externalId && <span className="mr-1 font-mono text-gray-500">#{s.externalId}</span>}
                          <span className="text-gray-700">{s.title}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLE[s.status]}`}>
                            {STATUS_LABEL[s.status]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-gray-800">
                          {s.leadTimeDays} d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
