"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient, automationMetricsApi, type AutomationMetrics } from "@/lib/api-client";
import { AutomationTrendChart } from "@/components/automation/AutomationTrendChart";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1F3864]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AutomationDashboardPage() {
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState(() => isoDaysAgo(84)); // ~12 semanas
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient<ProjectLite[]>("/api/projects")
      .then((rows) => {
        setProjects(rows);
        const clientIds = [...new Set(rows.map((p) => p.client.id))];
        if (clientIds.length === 1) {
          setClientId(clientIds[0]);
          const cp = rows.filter((p) => p.client.id === clientIds[0]);
          if (cp.length === 1) setProjectId(cp[0].id);
        }
      })
      .catch(() => setProjects([]));
  }, []);

  const clients = Array.from(new Map(projects.map((p) => [p.client.id, p.client])).values());
  const clientProjects = projects.filter((p) => p.client.id === clientId);

  const load = useCallback(async () => {
    if (!projectId) { setMetrics(null); return; }
    setLoading(true);
    try {
      setMetrics(await automationMetricsApi.get(projectId, from, to));
    } catch {
      setMetrics(null);
    }
    setLoading(false);
  }, [projectId, from, to]);

  useEffect(() => { load(); }, [load]);

  const t = metrics?.totals;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Dashboard de Automatización</h1>
        <p className="text-xs text-gray-400 mt-0.5">Producción de scripts y estabilidad de la suite</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cliente</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Proyecto</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!clientId}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Seleccionar proyecto —</option>
            {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-3">No hay proyectos de automatización todavía.</p>
          <Link href="/projects/new?modality=AUTOMATION" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider">
            Crear proyecto de automatización
          </Link>
        </div>
      ) : !projectId ? (
        <div className="text-center py-20 text-sm text-gray-400">Selecciona un cliente y proyecto para ver sus métricas.</div>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : !metrics || metrics.weeks.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-400">No hay registros de automatización en el rango seleccionado.</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Scripts creados" value={t!.scriptsCreated} sub={`${t!.scriptsRefactored} refactor · ${t!.scriptsFixed} corregidos`} />
            <KpiCard label="Ejecuciones" value={t!.execTotal} sub={`${t!.execPassed} pasaron · ${t!.execFailed} fallaron`} />
            <KpiCard label="Pass-rate" value={`${metrics.passRatePct}%`} sub="del período" />
            <KpiCard label="Semanas con datos" value={metrics.weeks.length} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1F3864] mb-3">Producción de scripts por semana</h2>
            <AutomationTrendChart
              data={metrics.weeks}
              lines={[
                { dataKey: "scriptsCreated", name: "Creados", color: "#1F3864" },
                { dataKey: "scriptsRefactored", name: "Refactor", color: "#4A90D9" },
                { dataKey: "scriptsFixed", name: "Corregidos", color: "#f59e0b" },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1F3864] mb-3">Estabilidad (pass-rate %) por semana</h2>
            <AutomationTrendChart
              data={metrics.weeks}
              unit="%"
              domain={[0, 100]}
              lines={[{ dataKey: "passRatePct", name: "Pass-rate", color: "#10b981" }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
