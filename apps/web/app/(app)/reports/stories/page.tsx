"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ClientOpt { id: string; name: string }
interface ProjectOpt { id: string; name: string; clientId: string; client?: { id: string; name: string } }
interface StoryOpt { id: string; externalId: string | null; title: string; projectId: string }

interface BreakdownCycle {
  cycleId: string;
  cycleName: string;
  startDate: string | null;
  endDate: string | null;
  designed: number;
  executed: number;
  defects: number;
  hasRecords: boolean;
}
interface BreakdownStory {
  id: string;
  externalId: string | null;
  title: string;
  cycles: BreakdownCycle[];
  totals: { designed: number; executed: number; defects: number };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums text-gray-900">{value}</span>
    </span>
  );
}

export default function StoryBreakdownPage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [stories, setStories] = useState<StoryOpt[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [storyId, setStoryId] = useState("");
  const [rows, setRows] = useState<BreakdownStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<ClientOpt[]>("/api/clients").then(setClients).catch(() => {});
    apiClient<ProjectOpt[]>("/api/projects").then(setProjects).catch(() => {});
  }, []);

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((p) => (p.clientId ?? p.client?.id) === clientId);
  }, [projects, clientId]);

  useEffect(() => {
    if (projectId && !filteredProjects.some((p) => p.id === projectId)) setProjectId("");
  }, [filteredProjects, projectId]);

  useEffect(() => {
    setStoryId("");
    if (!projectId) {
      setStories([]);
      return;
    }
    apiClient<StoryOpt[]>(`/api/stories?projectId=${projectId}`)
      .then(setStories)
      .catch(() => setStories([]));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ projectId });
    if (storyId) qs.set("storyId", storyId);
    apiClient<BreakdownStory[]>(`/api/reports/story-breakdown?${qs.toString()}`)
      .then(setRows)
      .catch((e: any) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, [projectId, storyId]);

  const totalsAll = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          designed: acc.designed + r.totals.designed,
          executed: acc.executed + r.totals.executed,
          defects: acc.defects + r.totals.defects,
        }),
        { designed: 0, executed: 0, defects: 0 },
      ),
    [rows],
  );

  return (
    <div className="p-6">
      {/* Header gradiente */}
      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] p-6 text-white shadow-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M10 12h4m-4 4h4m-4-8h4" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Reporte</p>
            <h1 className="text-3xl font-bold tracking-tight">Conglomerado por HU</h1>
            <p className="text-sm text-white/70">Métricas por HU y ciclo con totales de iteraciones</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Filtros</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cliente</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              <option value="">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Proyecto</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              <option value="">Selecciona un proyecto</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {!clientId && p.client?.name ? `${p.client.name} · ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Historia (opcional)</span>
            <select
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              disabled={!projectId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Todas las HU del proyecto</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.externalId ? `${s.externalId} — ` : ""}
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Totales globales */}
      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Diseñados (total)</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#2E5FA3]">{totalsAll.designed.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-gray-400">Casos de prueba</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Ejecutados (total)</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0891b2]">{totalsAll.executed.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-gray-400">Casos ejecutados</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Defectos (total)</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#dc2626]">{totalsAll.defects.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-gray-400">Bugs detectados</p>
          </div>
        </div>
      )}

      {/* Tarjetas por HU */}
      {!projectId ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center text-sm text-gray-500">
          Selecciona un proyecto para ver el conglomerado.
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Cargando…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Error: {error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center text-sm text-gray-500">
          Sin HUs en el proyecto (o no hay registros con los filtros actuales).
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((s) => (
            <article key={s.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <h2 className="text-sm font-bold text-[#1F3864]">
                  {s.externalId && <span className="font-mono text-gray-500">{s.externalId}</span>}
                  {s.externalId && <span className="text-gray-300"> · </span>}
                  <span>{s.title}</span>
                </h2>
                <span className="ml-auto text-[11px] text-gray-500">
                  {s.cycles.length} {s.cycles.length === 1 ? "ciclo" : "ciclos"}
                </span>
              </header>
              <div className="divide-y divide-gray-100">
                {s.cycles.length === 0 ? (
                  <p className="px-5 py-4 text-xs italic text-gray-400">La HU no tiene ciclos registrados.</p>
                ) : (
                  s.cycles.map((c) => (
                    <div key={c.cycleId} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                      <span className="min-w-[140px] font-semibold text-gray-800">{c.cycleName}</span>
                      <span className="text-xs text-gray-500">
                        semana <span className="font-mono">{formatDate(c.startDate)}</span>
                        {c.endDate && c.endDate !== c.startDate && (
                          <> → <span className="font-mono">{formatDate(c.endDate)}</span></>
                        )}
                      </span>
                      <div className="ml-auto flex items-center gap-4">
                        <Metric label="D" value={c.designed} accent="#2E5FA3" />
                        <Metric label="E" value={c.executed} accent="#0891b2" />
                        <Metric label="B" value={c.defects} accent="#dc2626" />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <footer className="flex flex-wrap items-center gap-4 border-t border-gray-200 bg-[#1F3864]/5 px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#1F3864]">
                  Total iteraciones
                </span>
                <div className="ml-auto flex items-center gap-4">
                  <Metric label="D" value={s.totals.designed} accent="#2E5FA3" />
                  <Metric label="E" value={s.totals.executed} accent="#0891b2" />
                  <Metric label="B" value={s.totals.defects} accent="#dc2626" />
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
