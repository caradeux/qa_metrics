"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  automationTestLinesApi,
  automationTestersApi,
  automationAssignmentsApi,
  setLineResponsible,
  type Complexity,
  type ProjectTester,
} from "@/lib/api-client";

export default function EditTestLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("MEDIUM");
  const [responsibleId, setResponsibleId] = useState("");
  const [testers, setTesters] = useState<ProjectTester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const line = await automationTestLinesApi.get(id);
        setName(line.name);
        setExternalId(line.externalId ?? "");
        setComplexity(line.complexity);
        const [projTesters, assignments] = await Promise.all([
          automationTestersApi.byProject(line.projectId),
          automationAssignmentsApi.byTestLine(id),
        ]);
        setTesters(projTesters);
        const active = assignments.find((a) => a.status === "ACTIVE");
        if (active) setResponsibleId(active.testerId);
      } catch (err: any) {
        setError(err.message || "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!responsibleId) { setError("Debes asignar un Analista QA Automatizador responsable"); return; }
    setSaving(true); setError("");
    try {
      await automationTestLinesApi.update(id, { name: name.trim(), complexity, externalId: externalId.trim() || null });
      await setLineResponsible(id, responsibleId);
      router.push("/automation/test-lines");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando…</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Editar Línea de Prueba</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
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
          <p className="mt-1 text-xs text-gray-400">Al cambiar el responsable, el anterior se marca como finalizado (DONE); sus registros se conservan.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">ID Externo (opcional)</label>
          <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
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
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
