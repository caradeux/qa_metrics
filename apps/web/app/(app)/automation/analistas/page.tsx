"use client";

import { useEffect, useState, useCallback } from "react";
import {
  apiClient,
  automationTeamApi,
  type ProjectAnalyst,
  type AnalystUserOption,
} from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectLite {
  id: string;
  name: string;
  modality: string;
  client: { id: string; name: string };
}

export default function AutomationAnalystsPage() {
  const { can } = usePermissions();
  const canManage = can("testers", "create");

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [analysts, setAnalysts] = useState<ProjectAnalyst[]>([]);
  const [analystUsers, setAnalystUsers] = useState<AnalystUserOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Alta
  const [pickUserId, setPickUserId] = useState("");
  const [allocation, setAllocation] = useState(100);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  // Baja
  const [removeTarget, setRemoveTarget] = useState<ProjectAnalyst | null>(null);
  const [removing, setRemoving] = useState(false);

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
    automationTeamApi.analystUsers().then(setAnalystUsers).catch(() => setAnalystUsers([]));
  }, []);

  const clients = Array.from(new Map(projects.map((p) => [p.client.id, p.client])).values());
  const clientProjects = projects.filter((p) => p.client.id === clientId);

  const load = useCallback(async (pid: string) => {
    if (!pid) { setAnalysts([]); return; }
    setLoading(true);
    try {
      setAnalysts(await automationTeamApi.analysts(pid));
    } catch {
      setAnalysts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(projectId); }, [projectId, load]);

  async function handleAdd() {
    if (!projectId || !pickUserId) { setError("Selecciona un analista"); return; }
    const u = analystUsers.find((a) => a.id === pickUserId);
    if (!u) return;
    setAdding(true); setError("");
    try {
      await automationTeamApi.add({ name: u.name, projectId, userId: u.id, allocation });
      setPickUserId(""); setAllocation(100);
      await load(projectId);
    } catch (err: any) {
      setError(err.message || "Error al agregar");
    }
    setAdding(false);
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await automationTeamApi.remove(removeTarget.id);
    } catch (err: any) {
      alert(err.message || "Error al quitar");
    }
    setRemoving(false);
    setRemoveTarget(null);
    load(projectId);
  }

  // Solo usuarios marcados como automatizadores (restricción) y que aún no están en el proyecto.
  const assignedUserIds = new Set(analysts.map((a) => a.userId).filter(Boolean));
  const availableUsers = analystUsers.filter((u) => u.isAutomation && !assignedUserIds.has(u.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Asignación Automatizador</h1>
        <p className="text-xs text-gray-400 mt-0.5">Quién automatiza en cada proyecto (asignables como responsables de líneas)</p>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cliente</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <svg className="w-4 h-4 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
      ) : (
        <div className="space-y-5">
          {canManage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-[#1F3864] mb-3">Agregar automatizador</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 min-w-[16rem]">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Analista (usuario QA)</label>
                  <select value={pickUserId} onChange={(e) => setPickUserId(e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
                    <option value="">— Seleccionar analista —</option>
                    {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Dedicación</label>
                  <select value={allocation} onChange={(e) => setAllocation(Number(e.target.value))}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
                    <option value={100}>100% (tiempo completo)</option>
                    <option value={50}>50% (medio tiempo)</option>
                  </select>
                </div>
                <button onClick={handleAdd} disabled={adding || !pickUserId}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-40">
                  {adding ? "Agregando…" : "Agregar"}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              {availableUsers.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No hay analistas marcados como <span className="font-medium">automatizador</span> disponibles.
                  Marca la opción "Es automatizador" al crear/editar el usuario en <a href="/users" className="underline hover:text-amber-800">Usuarios</a>.
                </p>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Analista</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cuenta</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Líneas asignadas</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Dedicación</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
                ) : analysts.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">Este proyecto aún no tiene analistas. Agrégalos arriba.</td></tr>
                ) : (
                  analysts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-medium text-sm text-gray-900">{a.name}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{a.user?.email ?? <span className="text-amber-600">sin cuenta</span>}</td>
                      <td className="px-5 py-3.5 text-sm">
                        {a._count.automationAssignments > 0
                          ? <span className="inline-flex items-center rounded-full bg-[#2E5FA3]/10 text-[#2E5FA3] px-2 py-0.5 text-xs font-medium">{a._count.automationAssignments} línea(s)</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-700 font-mono">{a.allocation}%</td>
                      <td className="px-5 py-3.5 text-right">
                        {can("testers", "delete") && (
                          <button onClick={() => setRemoveTarget(a)} className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition font-medium">Quitar</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Quitar analista del proyecto"
        message={`Se quitará a "${removeTarget?.name}" de este proyecto. Si tiene líneas asignadas con registros, se eliminarán.`}
        confirmLabel="Quitar"
        loading={removing}
      />
    </div>
  );
}
