"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  automationTestLinesApi,
  automationTestersApi,
  setLineResponsible,
  type Complexity,
  type ProjectTester,
} from "@/lib/api-client";

export default function NewTestLinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("MEDIUM");
  const [responsibleId, setResponsibleId] = useState("");
  const [testers, setTesters] = useState<ProjectTester[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    automationTestersApi.byProject(projectId).then(setTesters).catch(() => setTesters([]));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Falta el proyecto (vuelve a la lista y selecciónalo)"); return; }
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!responsibleId) { setError("Debes asignar un Analista QA Automatizador responsable"); return; }
    setSaving(true); setError("");
    try {
      const line = await automationTestLinesApi.create({
        projectId,
        name: name.trim(),
        complexity,
        externalId: externalId.trim() || null,
      });
      await setLineResponsible(line.id, responsibleId);
      router.push("/automation/test-lines");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nueva Línea de Prueba</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Ej. Regresión Checkout" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Analista QA Automatizador (responsable)</label>
          <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Seleccionar analista —</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {testers.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">Este proyecto no tiene analistas. Agrégalos en la gestión del proyecto.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">ID Externo (opcional)</label>
          <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Ej. SUITE-123" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Complejidad</label>
          <select value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
          </select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/automation/test-lines")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Crear Línea"}</button>
        </div>
      </form>
    </div>
  );
}
