"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient, automationTestLinesApi, type TestLine } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { ManualWorkNoticeModal } from "@/components/automation/ManualWorkNoticeModal";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
  _count?: { stories: number; testers: number };
}

const COMPLEXITY_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };

export default function TestLinesPage() {
  const { can } = usePermissions();
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [lines, setLines] = useState<TestLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestLine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [warnProject, setWarnProject] = useState<ProjectLite | null>(null);

  useEffect(() => {
    // Cualquier proyecto del cliente puede recibir automatización (no se filtra por modalidad).
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

  // Al elegir proyecto: si ya tiene QA Manual (historias), avisa con un modal antes de continuar.
  function handleSelectProject(id: string) {
    if (!id) { setProjectId(""); return; }
    const p = projects.find((x) => x.id === id);
    if (p && (p._count?.stories ?? 0) > 0) {
      setWarnProject(p);
    } else {
      setProjectId(id);
    }
  }

  // Cliente → Proyecto → Línea
  const clients = Array.from(
    new Map(projects.map((p) => [p.client.id, p.client])).values()
  );
  const clientProjects = projects.filter((p) => p.client.id === clientId);

  const fetchLines = useCallback(async (pid: string) => {
    if (!pid) { setLines([]); return; }
    setLoading(true);
    try {
      setLines(await automationTestLinesApi.list(pid));
    } catch {
      setLines([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLines(projectId); }, [projectId, fetchLines]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await automationTestLinesApi.remove(deleteTarget.id);
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchLines(projectId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Líneas de Prueba</h1>
          <p className="text-xs text-gray-400 mt-0.5">{lines.length} en el proyecto seleccionado</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects/new?modality=AUTOMATION"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2E5FA3] border border-[#2E5FA3]/30 rounded-md hover:bg-[#2E5FA3]/5 transition uppercase tracking-wider"
          >
            ＋ Proyecto de automatización
          </Link>
          {can("test-lines", "create") && projectId && (
            <Link
              href={`/automation/test-lines/new?projectId=${projectId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition-all duration-200 uppercase tracking-wider shadow-sm hover:shadow-md"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nueva Línea
            </Link>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <svg className="w-4 h-4 mt-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Proyecto</label>
          <select
            value={projectId}
            onChange={(e) => handleSelectProject(e.target.value)}
            disabled={!clientId}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">— Seleccionar proyecto —</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{(p._count?.stories ?? 0) > 0 ? " · (tiene QA Manual)" : ""}
              </option>
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
          <p className="text-xs text-gray-400 mt-3">¿El cliente aún no existe? <Link href="/clients/new" className="text-[#2E5FA3] hover:underline">Créalo primero</Link>.</p>
        </div>
      ) : !clientId ? (
        <div className="text-center py-20 text-sm text-gray-400">Selecciona un cliente para empezar.</div>
      ) : !projectId ? (
        <div className="text-center py-20 text-sm text-gray-400">Selecciona un proyecto del cliente para ver sus líneas de prueba.</div>
      ) : loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />)}</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-400">No hay líneas de prueba en este proyecto.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">ID Externo</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Complejidad</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Responsable</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors duration-150">
                  <td className="px-5 py-3.5 font-medium text-sm text-gray-900">{line.name}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">{line.externalId ?? "—"}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700">{COMPLEXITY_LABEL[line.complexity] ?? line.complexity}</td>
                  <td className="px-5 py-3.5 text-sm">
                    {line.assignments?.[0]?.tester?.name
                      ? <span className="text-gray-900">{line.assignments[0].tester.name}</span>
                      : <span className="text-amber-600 text-xs">Sin asignar</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {can("test-lines", "update") && (
                        <Link href={`/automation/test-lines/${line.id}/edit`} className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition-all duration-150 font-medium">Editar</Link>
                      )}
                      {can("test-lines", "delete") && (
                        <button onClick={() => setDeleteTarget(line)} className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-150 font-medium">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Línea de Prueba"
        message={`Se eliminará "${deleteTarget?.name}" y sus asignaciones/registros permanentemente.`}
        loading={deleting}
      />

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
