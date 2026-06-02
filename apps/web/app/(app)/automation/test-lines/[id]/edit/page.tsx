"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { automationTestLinesApi, type Complexity } from "@/lib/api-client";

export default function EditTestLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [complexity, setComplexity] = useState<Complexity>("MEDIUM");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    automationTestLinesApi.get(id)
      .then((line) => {
        setName(line.name);
        setExternalId(line.externalId ?? "");
        setComplexity(line.complexity);
      })
      .catch((err: any) => setError(err.message || "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await automationTestLinesApi.update(id, { name: name.trim(), complexity, externalId: externalId.trim() || null });
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
