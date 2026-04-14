"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Project { id: string; name: string; }
interface Tester { id: string; name: string; }

export default function NewAssignmentPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [projectId, setProjectId] = useState("");
  const [testerId, setTesterId] = useState("");
  const [storyId, setStoryId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Project[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) { setTesters([]); setTesterId(""); return; }
    apiClient<Tester[]>(`/api/testers?projectId=${projectId}`).then(setTesters).catch(() => setTesters([]));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testerId || !storyId || !startDate) { setError("Completa los campos obligatorios"); return; }
    setSaving(true); setError("");
    try {
      await apiClient("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          testerId,
          storyId,
          startDate,
          endDate: endDate || null,
          notes: notes || null,
        }),
      });
      router.push("/assignments");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nueva Asignacion</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Proyecto</label>
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTesterId(""); setStoryId(""); }} className={inp}>
            <option value="">Seleccionar...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tester</label>
            <select value={testerId} onChange={(e) => setTesterId(e.target.value)} disabled={!projectId} className={inp}>
              <option value="">Seleccionar...</option>
              {testers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ID Historia de Usuario</label>
            <input type="text" value={storyId} onChange={(e) => setStoryId(e.target.value)} className={inp} placeholder="ID de la HU" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha Inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha Fin Estimada</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Observaciones..." />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/assignments")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Crear Asignacion"}
          </button>
        </div>
      </form>
    </div>
  );
}
