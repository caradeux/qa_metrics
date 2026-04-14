"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Assignment {
  id: string; startDate: string; endDate: string | null;
  status: string; executionCycle: string | null; notes: string | null;
  tester: { id: string; name: string; project: { name: string; client: { name: string } } };
  story: { id: string; title: string };
}

const STATUSES = [
  { value: "REGISTERED", label: "Inicio" },
  { value: "ANALYSIS", label: "En Analisis" },
  { value: "TEST_DESIGN", label: "Diseno de Casos" },
  { value: "EXECUTION", label: "En Ejecucion" },
  { value: "RETURNED_TO_DEV", label: "Devuelto a Dev" },
  { value: "WAITING_UAT", label: "Espera UAT" },
  { value: "UAT", label: "En UAT" },
  { value: "PRODUCTION", label: "Produccion" },
];

export default function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Assignment | null>(null);
  const [status, setStatus] = useState("REGISTERED");
  const [endDate, setEndDate] = useState("");
  const [executionCycle, setExecutionCycle] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Assignment[]>("/api/assignments")
      .then((list) => {
        const a = list.find((x) => x.id === id);
        if (a) {
          setInfo(a);
          setStatus(a.status);
          setEndDate(a.endDate ? a.endDate.split("T")[0] : "");
          setExecutionCycle(a.executionCycle || "");
          setNotes(a.notes || "");
        } else setError("Asignacion no encontrada");
        setLoaded(true);
      })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiClient(`/api/assignments/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          endDate: endDate || null,
          executionCycle: executionCycle || null,
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

  if (!loaded) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Editar Asignacion</h1>
      {info && (
        <p className="text-sm text-muted mb-6">
          {info.tester.project.client.name} / {info.tester.project.name} &middot; {info.tester.name} &middot; {info.story.title}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Fecha Fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Ciclo de Ejecucion</label>
          <input type="text" value={executionCycle} onChange={(e) => setExecutionCycle(e.target.value)} className={inp} placeholder="Opcional" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Observaciones..." />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/assignments")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
