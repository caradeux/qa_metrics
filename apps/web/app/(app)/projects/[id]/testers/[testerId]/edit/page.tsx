"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Tester { id: string; name: string; projectId: string; }

export default function EditTesterPage({ params }: { params: Promise<{ id: string; testerId: string }> }) {
  const { id: projectId, testerId } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Tester>(`/api/testers/${testerId}`)
      .then((t) => { setName(t.name); setLoaded(true); })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
  }, [testerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/testers/${testerId}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
      router.push(`/projects/${projectId}/testers`);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Editar Tester</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inp} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`/projects/${projectId}/testers`)} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
