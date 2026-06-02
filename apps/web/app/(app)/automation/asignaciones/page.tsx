"use client";

import { useEffect, useState, useCallback } from "react";
import {
  apiClient,
  automationTestLinesApi,
  automationTestersApi,
  setLineResponsible,
  type TestLine,
  type ProjectTester,
} from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
}

export default function AutomationAssignmentsPage() {
  const { can } = usePermissions();
  const canAssign = can("automation-assignments", "update") || can("automation-assignments", "create");

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [lines, setLines] = useState<TestLine[]>([]);
  const [testers, setTesters] = useState<ProjectTester[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  useEffect(() => {
    apiClient<ProjectLite[]>("/api/projects")
      .then((rows) => {
        const autos = rows.filter((p) => p.modality === "AUTOMATION");
        setProjects(autos);
        const clientIds = [...new Set(autos.map((p) => p.client.id))];
        if (clientIds.length === 1) {
          setClientId(clientIds[0]);
          const cp = autos.filter((p) => p.client.id === clientIds[0]);
          if (cp.length === 1) setProjectId(cp[0].id);
        }
      })
      .catch(() => setProjects([]));
  }, []);

  const clients = Array.from(new Map(projects.map((p) => [p.client.id, p.client])).values());
  const clientProjects = projects.filter((p) => p.client.id === clientId);

  const load = useCallback(async (pid: string) => {
    if (!pid) { setLines([]); setTesters([]); return; }
    setLoading(true);
    try {
      const [ls, ts] = await Promise.all([
        automationTestLinesApi.list(pid),
        automationTestersApi.byProject(pid),
      ]);
      setLines(ls);
      setTesters(ts);
    } catch {
      setLines([]); setTesters([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(projectId); }, [projectId, load]);

  async function reassign(lineId: string, testerId: string) {
    if (!testerId) return;
    setSavingLineId(lineId);
    try {
      await setLineResponsible(lineId, testerId);
      await load(projectId);
    } catch (err: any) {
      alert(err.message || "Error al reasignar");
    }
    setSavingLineId(null);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Asignaciones de Automatización</h1>
        <p className="text-xs text-gray-400 mt-0.5">Responsable (Analista QA Automatizador) por línea de prueba</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cliente</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <svg className="w-4 h-4 mt-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Proyecto</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!clientId}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Seleccionar proyecto —</option>
            {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="text-center py-20 text-sm text-gray-400">Selecciona un cliente y proyecto.</div>
      ) : loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />)}</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-400">Este proyecto no tiene líneas de prueba.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Línea de prueba</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Responsable actual</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Reasignar</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const current = line.assignments?.[0]?.tester;
                return (
                  <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors duration-150">
                    <td className="px-5 py-3.5 font-medium text-sm text-gray-900">{line.name}</td>
                    <td className="px-5 py-3.5 text-sm">
                      {current ? <span className="text-gray-900">{current.name}</span> : <span className="text-amber-600 text-xs">Sin asignar</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={current?.id ?? ""}
                        disabled={!canAssign || savingLineId === line.id}
                        onChange={(e) => reassign(line.id, e.target.value)}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">— Seleccionar analista —</option>
                        {testers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {savingLineId === line.id && <span className="ml-2 text-xs text-gray-400">Guardando…</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
