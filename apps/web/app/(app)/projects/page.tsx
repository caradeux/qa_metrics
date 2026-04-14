"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Project {
  id: string;
  name: string;
  modality: "MANUAL" | "AZURE_DEVOPS";
  createdAt: string;
  client: { id: string; name: string };
  testers?: Array<{ id: string; name: string; allocation: number }>;
  _count?: { cycles: number; testers: number; stories: number };
}

interface ClientGroup {
  clientName: string;
  projects: Project[];
}

interface QuickListItem { id: string; name: string; extra?: string }
interface AnalystOpt { id: string; name: string; email: string; allocationAvailable: number }

export default function ProjectsPage() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quick, setQuick] = useState<{ project: Project; kind: "testers" | "cycles"; items: QuickListItem[] | null } | null>(null);
  const [analysts, setAnalysts] = useState<AnalystOpt[]>([]);
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { can } = usePermissions();

  async function loadQuickItems(project: Project, kind: "testers" | "cycles") {
    if (kind === "testers") {
      const rows = await apiClient<any[]>(`/api/testers?projectId=${project.id}`);
      return rows.map(t => ({ id: t.id, name: t.name, extra: `${t.allocation ?? 100}%` }));
    } else {
      const rows = await apiClient<any[]>(`/api/cycles?projectId=${project.id}`);
      return rows.map(c => ({ id: c.id, name: c.name, extra: c.startDate ? new Date(c.startDate).toLocaleDateString("es") : undefined }));
    }
  }

  async function openQuick(project: Project, kind: "testers" | "cycles") {
    setQuick({ project, kind, items: null });
    setFormError(null);
    setDraft(kind === "testers" ? { userId: "", name: "", allocation: 100 } : { name: "", startDate: "", endDate: "" });
    try {
      const items = await loadQuickItems(project, kind);
      setQuick({ project, kind, items });
      if (kind === "testers") {
        apiClient<AnalystOpt[]>(`/api/users?role=QA_ANALYST&minCapacity=50`).then(setAnalysts).catch(() => setAnalysts([]));
      }
    } catch {
      setQuick(q => q ? { ...q, items: [] } : null);
    }
  }

  async function submitDraft() {
    if (!quick) return;
    setSaving(true); setFormError(null);
    try {
      if (quick.kind === "testers") {
        if (!draft.name?.trim()) { setFormError("Nombre requerido"); setSaving(false); return; }
        await apiClient("/api/testers", {
          method: "POST",
          body: JSON.stringify({
            projectId: quick.project.id,
            name: draft.name.trim(),
            userId: draft.userId || null,
            allocation: draft.allocation,
          }),
        });
      } else {
        if (!draft.name?.trim()) { setFormError("Nombre requerido"); setSaving(false); return; }
        await apiClient("/api/cycles", {
          method: "POST",
          body: JSON.stringify({
            projectId: quick.project.id,
            name: draft.name.trim(),
            startDate: draft.startDate || null,
            endDate: draft.endDate || null,
          }),
        });
      }
      // refrescar lista interna + contadores del proyecto
      const items = await loadQuickItems(quick.project, quick.kind);
      setQuick({ ...quick, items });
      setDraft(quick.kind === "testers" ? { userId: "", name: "", allocation: 100 } : { name: "", startDate: "", endDate: "" });
      fetchProjects();
    } catch (err: any) {
      setFormError(err?.message ?? "Error al guardar");
    } finally { setSaving(false); }
  }

  const fetchProjects = useCallback(async () => {
    try {
      const data = await apiClient<Project[]>("/api/projects");
      const grouped = data.reduce<Record<string, Project[]>>((acc, p) => {
        const key = p.client.name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      setGroups(
        Object.entries(grouped).map(([clientName, projects]) => ({
          clientName,
          projects,
        }))
      );
    } catch (err) {
      console.error(err);
      setGroups([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchProjects();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
        {can("projects", "create") && (
          <Link
            href="/projects/new"
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition"
          >
            + Nuevo Proyecto
          </Link>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p>No hay proyectos registrados.</p>
          {can("projects", "create") && (
            <Link href="/projects/new" className="mt-2 text-secondary hover:underline">
              Crear el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.clientName} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-border">
                <h2 className="font-semibold text-foreground">{group.clientName}</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted border-b border-border">
                    <th className="px-4 py-2 font-medium">Proyecto</th>
                    <th className="px-4 py-2 font-medium text-center">HUs</th>
                    <th className="px-4 py-2 font-medium text-center">Ciclos</th>
                    <th className="px-4 py-2 font-medium text-center">Testers</th>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {group.projects.map((project, idx) => (
                    <tr
                      key={project.id}
                      className={`border-t border-border hover:bg-gray-50 transition ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{project.name}</td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/projects/${project.id}/stories`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${project._count?.stories ? "bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100" : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${project._count?.stories ? "bg-violet-500" : "bg-gray-400"}`} />
                          {project._count?.stories || "Sin HUs"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => openQuick(project, "cycles")} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${project._count?.cycles ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${project._count?.cycles ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {project._count?.cycles || "Sin ciclos"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {project.testers && project.testers.length > 0 ? (
                          <button type="button" onClick={() => openQuick(project, "testers")} className="flex flex-wrap gap-1 max-w-[320px] text-left group">
                            {project.testers.map(t => (
                              <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 group-hover:bg-blue-100">
                                {t.name}
                                <span className="text-blue-400">· {t.allocation}%</span>
                              </span>
                            ))}
                          </button>
                        ) : (
                          <button type="button" onClick={() => openQuick(project, "testers")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Sin testers
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-sm">
                        {new Date(project.createdAt).toLocaleDateString("es")}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          href={`/projects/${project.id}/stories`}
                          className="text-sm text-secondary hover:underline"
                        >
                          HUs
                        </Link>
                        {can("projects", "update") && (
                          <Link
                            href={`/projects/${project.id}/edit`}
                            className="text-sm text-secondary hover:underline"
                          >
                            Editar
                          </Link>
                        )}
                        {can("projects", "delete") && (
                          <button
                            onClick={() => setDeleteTarget(project)}
                            className="text-sm text-danger hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Proyecto"
        message={`¿Estas seguro de eliminar "${deleteTarget?.name}"? Se eliminaran todos los datos asociados.`}
        loading={deleting}
      />

      <Modal
        open={!!quick}
        onClose={() => setQuick(null)}
        title={quick ? `${quick.kind === "testers" ? "Testers" : "Ciclos"} · ${quick.project.name}` : ""}
      >
        {quick && (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-blue-700/80">Proyecto</p>
              <p className="text-sm font-semibold text-[#1F3864]">{quick.project.name}</p>
              <p className="text-[11px] text-gray-500">Cliente: {quick.project.client.name}</p>
            </div>

            {/* Listado */}
            {quick.items === null ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : quick.items.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay {quick.kind === "testers" ? "testers" : "ciclos"}.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white max-h-40 overflow-auto">
                {quick.items.map(it => (
                  <li key={it.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-gray-900">{it.name}</span>
                    {it.extra && <span className="text-xs text-gray-500">{it.extra}</span>}
                  </li>
                ))}
              </ul>
            )}

            {/* Form inline */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Agregar {quick.kind === "testers" ? "tester" : "ciclo"}
              </p>
              {quick.kind === "testers" ? (
                <>
                  <select
                    value={draft.userId ?? ""}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const u = analysts.find(a => a.id === uid);
                      setDraft({ ...draft, userId: uid, name: u ? u.name : draft.name });
                    }}
                    className="w-full rounded border border-gray-300 p-1.5 text-sm"
                  >
                    <option value="">— Tester sin cuenta —</option>
                    {analysts.filter(a => a.allocationAvailable >= (draft.allocation ?? 100)).map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {a.allocationAvailable}% disp.</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Nombre del tester"
                    className="w-full rounded border border-gray-300 p-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    {[50, 100].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDraft({ ...draft, allocation: pct })}
                        className={`flex-1 rounded border px-2 py-1 text-xs font-semibold ${draft.allocation === pct ? "border-[#2E5FA3] bg-[#2E5FA3]/10 text-[#2E5FA3]" : "border-gray-200 text-gray-600"}`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Nombre del ciclo (ej. Ciclo 1)"
                    className="w-full rounded border border-gray-300 p-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={draft.startDate ?? ""}
                      onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                      className="flex-1 rounded border border-gray-300 p-1.5 text-sm"
                      placeholder="Inicio"
                    />
                    <input
                      type="date"
                      value={draft.endDate ?? ""}
                      onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                      className="flex-1 rounded border border-gray-300 p-1.5 text-sm"
                      placeholder="Fin"
                    />
                  </div>
                </>
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
