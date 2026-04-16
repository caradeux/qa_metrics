"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface Tester {
  id: string;
  name: string;
  projectId: string;
  userId: string | null;
  allocation: number;
}

interface AnalystUser {
  id: string;
  name: string;
  email: string;
  allocationAvailable?: number;
  allowOverallocation?: boolean;
}

export default function EditTesterPage({ params }: { params: Promise<{ id: string; testerId: string }> }) {
  const { id: projectId, testerId } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [allocation, setAllocation] = useState<number>(100);
  const [analysts, setAnalysts] = useState<AnalystUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Tester>(`/api/testers/${testerId}`)
      .then((t) => {
        setName(t.name);
        setUserId(t.userId ?? "");
        setAllocation(t.allocation ?? 100);
        setLoaded(true);
      })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
    apiClient<AnalystUser[]>("/api/users?role=QA_ANALYST")
      .then(setAnalysts)
      .catch(() => setAnalysts([]));
  }, [testerId]);

  const selected = useMemo(() => analysts.find((a) => a.id === userId), [analysts, userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/testers/${testerId}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim(), userId: userId || null, allocation }),
      });
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
          <label className="block text-sm font-medium text-foreground mb-1">
            Vincular a analista
            <span className="text-xs text-gray-400 font-normal ml-2">(para que pueda loguearse)</span>
          </label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inp}>
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
          {selected && (
            <p className="text-[11px] text-gray-500 mt-1">
              Linkeado a <span className="font-medium">{selected.email}</span>.
              Si lo desvinculas, el analista dejará de ver este proyecto en su listado.
            </p>
          )}
          {!selected && (
            <p className="text-[11px] text-amber-600 mt-1">
              Este tester no tiene cuenta de usuario → el analista no puede loguearse ni ver este proyecto en /projects.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre del tester</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inp} />
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
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
