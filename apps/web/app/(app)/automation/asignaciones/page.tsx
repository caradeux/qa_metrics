"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  apiClient,
  automationTestLinesApi,
  automationTestersApi,
  setLineResponsible,
  type TestLine,
  type ProjectTester,
} from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { ManualWorkNoticeModal } from "@/components/automation/ManualWorkNoticeModal";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
  _count?: { stories: number; testers: number };
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
  const [warnProject, setWarnProject] = useState<ProjectLite | null>(null);

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

  function handleSelectProject(id: string) {
    if (!id) { setProjectId(""); return; }
    const p = projects.find((x) => x.id === id);
    if (p && (p._count?.stories ?? 0) > 0) setWarnProject(p);
    else setProjectId(id);
  }

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
          <select value={projectId} onChange={(e) => handleSelectProject(e.target.value)} disabled={!clientId}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Seleccionar proyecto —</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{(p._count?.stories ?? 0) > 0 ? " · (tiene QA Manual)" : ""}</option>
            ))}
          </select>
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

      <ManualWorkNoticeModal
        open={!!warnProject}
        projectName={warnProject?.name ?? ""}
        storyCount={warnProject?._count?.stories ?? 0}
        onContinue={() => { if (warnProject) setProjectId(warnProject.id); setWarnProject(null); }}
        onCancel={() => setWarnProject(null)}
      />
    </div>
  );
}
