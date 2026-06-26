"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ClientOpt { id: string; name: string }
interface Hu {
  storyId: string;
  externalId: string | null;
  title: string;
  missing: "Diseño" | "Ejecución";
  statusLabel: string;
  testerName: string;
  since: string | null;
  changedToday: boolean;
}
interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  hus: Hu[];
}
interface Response {
  generatedAt: string;
  totalHus: number;
  totalChangedToday: number;
  projects: ProjectGroup[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Santiago" });
}

function MissingChip({ missing }: { missing: "Diseño" | "Ejecución" }) {
  const isDesign = missing === "Diseño";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isDesign
          ? "bg-sky-50 text-sky-700 border border-sky-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}
    >
      Falta {missing.toLowerCase()}
    </span>
  );
}

export default function HusSinRegistrosPage() {
  const [data, setData] = useState<Response | null>(null);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiClient<ClientOpt[]>("/api/clients").then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = clientId ? `?clientId=${clientId}` : "";
    apiClient<Response>(`/api/admin/hus-sin-registros${qs}`)
      .then(setData)
      .catch((e: any) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, [clientId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.projects;
    return data.projects
      .map((p) => ({
        ...p,
        hus: p.hus.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            (h.externalId ?? "").toLowerCase().includes(q) ||
            h.testerName.toLowerCase().includes(q),
        ),
      }))
      .filter((p) => p.hus.length > 0 || p.projectName.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q));
  }, [data, query]);

  const shownHus = filtered.reduce((s, p) => s + p.hus.length, 0);

  return (
    <div className="p-6">
      {/* Header gradiente */}
      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] p-6 text-white shadow-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Admin · Control de calidad de datos</p>
            <h1 className="text-3xl font-bold tracking-tight">HUs sin registros</h1>
            <p className="text-sm text-white/70">
              HUs en Diseño o Ejecución cuyo ciclo actual no tiene cargada la métrica de su fase (diseñados=0 en Diseño, ejecutados=0 en Ejecución). Salen vacías en informes.
            </p>
          </div>
        </div>
      </div>

      {/* Resumen + filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="rounded-xl border bg-white px-5 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">HUs sin registros</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-[#dc2626]">{data ? data.totalHus : "—"}</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Proyectos afectados</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-[#2E5FA3]">{data ? data.projects.length : "—"}</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-3 shadow-sm" title="Entraron a su estado hoy — puede que recién las estén trabajando">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cambiaron hoy</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-amber-600">{data ? data.totalChangedToday : "—"}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar HU, ID o analista…"
            className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Cargando…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Error: {error}</div>
      ) : !data || data.totalHus === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-10 text-center text-sm text-emerald-700">
          ✓ No hay HUs en Diseño o Ejecución sin registros del ciclo actual. Todo cargado.
        </div>
      ) : shownHus === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center text-sm text-gray-500">
          Sin resultados para “{query}”.
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((p) => (
            <article key={p.projectId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1F3864]">{p.projectName}</h2>
                  <p className="text-[11px] text-gray-500">{p.clientName}</p>
                </div>
                <span className="ml-auto inline-flex items-center rounded-full bg-[#dc2626]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                  {p.hus.length} {p.hus.length === 1 ? "HU" : "HUs"}
                </span>
              </header>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-2">Historia de Usuario</th>
                    <th className="px-3 py-2">Falta</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Analista</th>
                    <th className="px-5 py-2">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {p.hus.map((h) => (
                    <tr key={h.storyId} className="hover:bg-gray-50/60">
                      <td className="px-5 py-2.5">
                        {h.externalId && <span className="font-mono text-xs text-gray-500">{h.externalId} · </span>}
                        <span className="text-gray-900">{h.title}</span>
                        {h.changedToday && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200" title="Entró a este estado hoy — puede que recién la estén trabajando">
                            cambió hoy
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><MissingChip missing={h.missing} /></td>
                      <td className="px-3 py-2.5 text-gray-600">{h.statusLabel}</td>
                      <td className="px-3 py-2.5 text-gray-700">{h.testerName}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{formatDate(h.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
