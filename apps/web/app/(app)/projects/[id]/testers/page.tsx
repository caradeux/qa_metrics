"use client";

import { useEffect, useState, useCallback, use } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Tester {
  id: string;
  name: string;
  allocation?: number;
  _count: { records: number };
}

interface Project {
  id: string;
  name: string;
  client: { name: string };
}

export default function TestersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Tester | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchData = useCallback(async () => {
    try {
      const [proj, testersData] = await Promise.all([
        apiClient<Project>(`/api/projects/${projectId}`),
        apiClient<Tester[]>(`/api/testers?projectId=${projectId}`),
      ]);
      setProject(proj);
      setTesters(testersData);
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
      await apiClient(`/api/testers/${deleteTarget.id}`, { method: "DELETE" });
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
        <Link href="/projects" className="text-sm text-secondary hover:underline">
          ← Volver a Proyectos
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Testers</h1>
          <p className="text-sm text-muted">
            {project?.client.name} / {project?.name}
          </p>
        </div>
        {can("testers", "create") && (
          <Link href={`/projects/${projectId}/testers/new`} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition">
            + Nuevo Tester
          </Link>
        )}
      </div>

      {testers.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p>No hay testers en este proyecto.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-white text-left text-sm">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium text-center">Dedicación</th>
                <th className="px-4 py-3 font-medium">Registros</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {testers.map((tester, idx) => (
                <tr
                  key={tester.id}
                  className={`border-t border-border hover:bg-gray-50 transition ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{tester.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      (tester.allocation ?? 100) === 100
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>{tester.allocation ?? 100}%</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{tester._count.records}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {can("testers", "update") && (
                      <Link href={`/projects/${projectId}/testers/${tester.id}/edit`} className="text-sm text-secondary hover:underline">
                        Editar
                      </Link>
                    )}
                    {can("testers", "delete") && (
                      <button onClick={() => setDeleteTarget(tester)} className="text-sm text-danger hover:underline">
                        Eliminar
                      </button>
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
        title="Eliminar Tester"
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
