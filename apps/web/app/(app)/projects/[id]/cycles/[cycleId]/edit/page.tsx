"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Cycle { id: string; name: string; startDate: string | null; endDate: string | null; }

export default function EditCyclePage({ params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const { id: projectId, cycleId } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Cycle[]>(`/api/cycles?projectId=${projectId}`)
      .then((list) => {
        const c = list.find((x) => x.id === cycleId);
        if (c) {
          setName(c.name);
          setStartDate(c.startDate ? c.startDate.split("T")[0] : "");
          setEndDate(c.endDate ? c.endDate.split("T")[0] : "");
        } else setError("Ciclo no encontrado");
        setLoaded(true);
      })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
  }, [projectId, cycleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    const body: Record<string, string> = { name: name.trim() };
    if (startDate) body.startDate = startDate;
    if (endDate) body.endDate = endDate;
    try {
      await apiClient(`/api/cycles/${cycleId}`, { method: "PUT", body: JSON.stringify(body) });
      router.push(`/projects/${projectId}/cycles`);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Editar Ciclo</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha Inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha Fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inp} />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`/projects/${projectId}/cycles`)} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
