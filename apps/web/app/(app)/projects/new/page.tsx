"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Client {
  id: string;
  name: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [modality, setModality] = useState<"MANUAL" | "AZURE_DEVOPS">("MANUAL");
  const [adoOrgUrl, setAdoOrgUrl] = useState("");
  const [adoProject, setAdoProject] = useState("");
  const [adoToken, setAdoToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Client[]>("/api/clients")
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await apiClient("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          clientId,
          modality,
          ...(modality === "AZURE_DEVOPS" && { adoOrgUrl, adoProject, adoToken }),
        }),
      });
      router.push("/projects");
    } catch (err: any) {
      setError(err.message || "Error al crear el proyecto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nuevo Proyecto</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Seleccionar cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre del Proyecto</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Nombre del proyecto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Modalidad</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={modality === "MANUAL"}
                onChange={() => setModality("MANUAL")}
                className="text-primary"
              />
              <span className="text-sm">Manual</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={modality === "AZURE_DEVOPS"}
                onChange={() => setModality("AZURE_DEVOPS")}
                className="text-primary"
              />
              <span className="text-sm">Azure DevOps</span>
            </label>
          </div>
        </div>

        {modality === "AZURE_DEVOPS" && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800">Configuracion Azure DevOps</h3>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">URL de Organizacion</label>
              <input
                type="url"
                value={adoOrgUrl}
                onChange={(e) => setAdoOrgUrl(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="https://dev.azure.com/mi-organizacion"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre del Proyecto ADO</label>
              <input
                type="text"
                value={adoProject}
                onChange={(e) => setAdoProject(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="nombre-del-proyecto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Personal Access Token (PAT)</label>
              <input
                type="password"
                value={adoToken}
                onChange={(e) => setAdoToken(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="Token de acceso"
              />
              <p className="text-xs text-muted mt-1">Se almacenara cifrado. Nunca se mostrara en texto plano.</p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50"
          >
            {saving ? "Creando..." : "Crear Proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
