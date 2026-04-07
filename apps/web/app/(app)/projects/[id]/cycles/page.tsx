"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Cycle {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  _count: { records: number; stories: number };
}

interface Project {
  id: string;
  name: string;
  client: { name: string };
}

export default function CyclesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Cycle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchData = useCallback(async () => {
    try {
      const [proj, cyclesData] = await Promise.all([
        apiClient<Project>(`/api/projects/${projectId}`),
        apiClient<Cycle[]>(`/api/cycles?projectId=${projectId}`),
      ]);
      setProject(proj);
      setCycles(cyclesData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditingCycle(null);
    setName(""); setStartDate(""); setEndDate("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(cycle: Cycle) {
    setEditingCycle(cycle);
    setName(cycle.name);
    setStartDate(cycle.startDate ? cycle.startDate.split("T")[0] : "");
    setEndDate(cycle.endDate ? cycle.endDate.split("T")[0] : "");
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");

    const url = editingCycle ? `/api/cycles/${editingCycle.id}` : "/api/cycles";
    const method = editingCycle ? "PUT" : "POST";
    const body: Record<string, string> = { name: name.trim() };
    if (!editingCycle) body.projectId = projectId;
    if (startDate) body.startDate = startDate;
    if (endDate) body.endDate = endDate;

    try {
      await apiClient(url, {
        method,
        body: JSON.stringify(body),
      });
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/cycles/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchData();
  }

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  return (
    <div>
      <div className="mb-4">
        <Link href="/projects" className="text-sm text-secondary hover:underline">← Volver a Proyectos</Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ciclos de Prueba</h1>
          <p className="text-sm text-muted">{project?.client.name} / {project?.name}</p>
        </div>
        {can("cycles", "create") && (
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition">
            + Nuevo Ciclo
          </button>
        )}
      </div>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-muted"><p>No hay ciclos en este proyecto.</p></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-white text-left text-sm">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Inicio</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">HU</th>
                <th className="px-4 py-3 font-medium">Registros</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle, idx) => (
                <tr key={cycle.id} className={`border-t border-border hover:bg-gray-50 transition ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{cycle.name}</td>
                  <td className="px-4 py-3 text-muted text-sm">{cycle.startDate ? new Date(cycle.startDate).toLocaleDateString("es") : "-"}</td>
                  <td className="px-4 py-3 text-muted text-sm">{cycle.endDate ? new Date(cycle.endDate).toLocaleDateString("es") : "-"}</td>
                  <td className="px-4 py-3 text-muted">{cycle._count.stories}</td>
                  <td className="px-4 py-3 text-muted">{cycle._count.records}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {can("cycles", "update") && (
                      <button onClick={() => openEdit(cycle)} className="text-sm text-secondary hover:underline">Editar</button>
                    )}
                    {can("cycles", "delete") && (
                      <button onClick={() => setDeleteTarget(cycle)} className="text-sm text-danger hover:underline">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingCycle ? "Editar Ciclo" : "Nuevo Ciclo"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Ej: Sprint 1-4" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fecha Inicio</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fecha Fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Ciclo"
        message={
          deleteTarget && deleteTarget._count.records > 0
            ? `"${deleteTarget.name}" tiene ${deleteTarget._count.records} registros. No se puede eliminar.`
            : `¿Estas seguro de eliminar "${deleteTarget?.name}"?`
        }
        loading={deleting}
      />
    </div>
  );
}
