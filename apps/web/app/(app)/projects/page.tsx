"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Project {
  id: string;
  name: string;
  modality: "MANUAL" | "AZURE_DEVOPS";
  createdAt: string;
  client: { id: string; name: string };
}

interface ClientGroup {
  clientName: string;
  projects: Project[];
}

export default function ProjectsPage() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

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
                    <th className="px-4 py-2 font-medium">Modalidad</th>
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
                      <td className="px-4 py-3">
                        <Badge variant={project.modality === "MANUAL" ? "manual" : "azure"}>
                          {project.modality === "MANUAL" ? "Manual" : "Azure DevOps"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted text-sm">
                        {new Date(project.createdAt).toLocaleDateString("es")}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          href={`/projects/${project.id}/testers`}
                          className="text-sm text-secondary hover:underline"
                        >
                          Testers
                        </Link>
                        <Link
                          href={`/projects/${project.id}/cycles`}
                          className="text-sm text-secondary hover:underline"
                        >
                          Ciclos
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
    </div>
  );
}
