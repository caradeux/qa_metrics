"use client";

import { useEffect, useState, useCallback, use } from "react";
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
          <Link href={`/projects/${projectId}/cycles/new`} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition">
            + Nuevo Ciclo
          </Link>
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
                      <Link href={`/projects/${projectId}/cycles/${cycle.id}/edit`} className="text-sm text-secondary hover:underline">Editar</Link>
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
