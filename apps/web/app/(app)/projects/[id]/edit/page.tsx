"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
  modality: "MANUAL" | "AZURE_DEVOPS";
  clientId: string;
  adoOrgUrl: string | null;
  adoProject: string | null;
  projectManagerId: string | null;
  client: { name: string };
}

interface PmUser {
  id: string;
  name: string;
  email: string;
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [adoOrgUrl, setAdoOrgUrl] = useState("");
  const [adoProject, setAdoProject] = useState("");
  const [adoToken, setAdoToken] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [pms, setPms] = useState<PmUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Project>(`/api/projects/${projectId}`)
      .then((p) => {
        setProject(p);
        setName(p.name);
        setAdoOrgUrl(p.adoOrgUrl || "");
        setAdoProject(p.adoProject || "");
        setProjectManagerId(p.projectManagerId || "");
      })
      .catch((err) => console.error(err));
    apiClient<PmUser[]>("/api/users?role=CLIENT_PM")
      .then(setPms)
      .catch(() => setPms([]));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body: Record<string, any> = { name: name.trim(), projectManagerId: projectManagerId || null };
    if (project?.modality === "AZURE_DEVOPS") {
      body.adoOrgUrl = adoOrgUrl;
      body.adoProject = adoProject;
      if (adoToken) body.adoToken = adoToken;
    }

    try {
      await apiClient(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      router.push("/projects");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!project) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Editar Proyecto</h1>
      <p className="text-sm text-muted mb-6">{project.client.name} / {project.name}</p>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Jefe de Proyecto (Cliente)</label>
          <select
            value={projectManagerId}
            onChange={(e) => setProjectManagerId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">— Sin asignar —</option>
            {pms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {project.modality === "AZURE_DEVOPS" && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800">Azure DevOps</h3>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">URL de Organizacion</label>
              <input type="url" value={adoOrgUrl} onChange={(e) => setAdoOrgUrl(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre del Proyecto</label>
              <input type="text" value={adoProject} onChange={(e) => setAdoProject(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nuevo PAT (dejar vacio para mantener el actual)</label>
              <input type="password" value={adoToken} onChange={(e) => setAdoToken(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Nuevo token..." />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/projects")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
