"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface AnalystUser {
  id: string;
  name: string;
  email: string;
  allocationUsed?: number;
  allocationAvailable?: number;
  allowOverallocation?: boolean;
}

export default function NewTesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [analysts, setAnalysts] = useState<AnalystUser[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [allocation, setAllocation] = useState<number>(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Traemos TODOS los analistas (sin filtro de capacidad) para evitar crear testers
  // "sin cuenta" cuando el analista ya está ocupado al 100%.
  useEffect(() => {
    apiClient<AnalystUser[]>("/api/users?role=QA_ANALYST")
      .then(setAnalysts)
      .catch(() => setAnalysts([]));
  }, []);

  function onPickUser(id: string) {
    setUserId(id);
    if (id) {
      const u = analysts.find((a) => a.id === id);
      if (u) setName(u.name);
    }
  }

  const selected = useMemo(() => analysts.find((a) => a.id === userId), [analysts, userId]);
  const available = selected?.allocationAvailable ?? 100;
  const willOverallocate = !!selected && !selected.allowOverallocation && available < allocation;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await apiClient("/api/testers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), projectId, userId: userId || null, allocation }),
      });
      router.push(`/projects/${projectId}/testers`);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nuevo Tester</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Vincular a analista existente
            <span className="text-red-500 ml-1">*</span>
            <span className="text-xs text-gray-400 font-normal ml-2">(recomendado)</span>
          </label>
          <select value={userId} onChange={(e) => onPickUser(e.target.value)} className={inp}>
            <option value="">— Tester sin cuenta —</option>
            {analysts.map((a) => {
              const av = a.allocationAvailable ?? 100;
              const overflow = a.allowOverallocation
                ? " (sin límite)"
                : av <= 0
                  ? " (ocupado)"
                  : ` (${av}% disponible)`;
              return (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email}){overflow}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            Vincular el tester a un User permite que el analista se loguee y cargue sus registros.
            Si no lo vinculas, no podrá ver este proyecto en su listado.
          </p>
          {willOverallocate && (
            <div className="mt-2 px-3 py-2 bg-amber-50 border-l-4 border-amber-300 rounded-r">
              <p className="text-[11px] text-amber-800">
                <span className="font-semibold">Atención:</span> {selected!.name} tiene solo {available}% disponible.
                Al crearlo con {allocation}% sobrecargarás al analista. Considera bajar la dedicación o pedirle
                al LEADER que active "allowOverallocation" en el User.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre del tester</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inp} placeholder="Nombre del tester" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Dedicación al proyecto</label>
          <div className="grid grid-cols-2 gap-3">
            {[50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setAllocation(pct)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  allocation === pct
                    ? "border-[#2E5FA3] bg-[#2E5FA3]/5 shadow-sm"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className={`text-lg font-bold ${allocation === pct ? "text-[#2E5FA3]" : "text-gray-700"}`}>{pct}%</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{pct === 100 ? "Tiempo completo" : "Medio tiempo"}</p>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`/projects/${projectId}/testers`)} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Crear Tester"}
          </button>
        </div>
      </form>
    </div>
  );
}
