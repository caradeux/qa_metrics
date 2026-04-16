"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { RESOURCES, ACTIONS, RESOURCE_LABELS, ACTION_LABELS, permKey } from "@/lib/permissions";

export default function NewRolePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function togglePerm(r: string, a: string) {
    setPermSet((prev) => { const next = new Set(prev); const k = permKey(r, a); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  }
  function toggleRow(r: string) {
    const all = ACTIONS.every((a) => permSet.has(permKey(r, a)));
    setPermSet((prev) => { const next = new Set(prev); ACTIONS.forEach((a) => { const k = permKey(r, a); if (all) next.delete(k); else next.add(k); }); return next; });
  }
  function toggleCol(a: string) {
    const all = RESOURCES.every((r) => permSet.has(permKey(r, a)));
    setPermSet((prev) => { const next = new Set(prev); RESOURCES.forEach((r) => { const k = permKey(r, a); if (all) next.delete(k); else next.add(k); }); return next; });
  }
  function toggleAll() {
    const total = RESOURCES.length * ACTIONS.length;
    if (permSet.size === total) setPermSet(new Set());
    else { const n = new Set<string>(); RESOURCES.forEach((r) => ACTIONS.forEach((a) => n.add(permKey(r, a)))); setPermSet(n); }
  }
  const isRow = (r: string) => ACTIONS.every((a) => permSet.has(permKey(r, a)));
  const isCol = (a: string) => RESOURCES.every((r) => permSet.has(permKey(r, a)));
  const isAll = permSet.size === RESOURCES.length * ACTIONS.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (permSet.size === 0) { setError("Selecciona al menos un permiso"); return; }
    setSaving(true); setError("");
    try {
      await apiClient("/api/roles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(permSet).map((k) => { const [resource, action] = k.split(":"); return { resource, action }; }),
        }),
      });
      router.push("/settings/roles");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nuevo Rol</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre del rol</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inp} placeholder="Ej: Supervisor" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Descripcion</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Descripcion breve del rol" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Matriz de permisos</label>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-40">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isAll} onChange={toggleAll} className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] cursor-pointer" />
                      Recurso
                    </label>
                  </th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={isCol(a)} onChange={() => toggleCol(a)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] cursor-pointer" />
                        {ACTION_LABELS[a]}
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r, idx) => (
                  <tr key={r} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-100 last:border-b-0`}>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isRow(r)} onChange={() => toggleRow(r)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] cursor-pointer" />
                        <span className="text-xs font-medium text-gray-700">{RESOURCE_LABELS[r]}</span>
                      </label>
                    </td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="px-2 py-2 text-center">
                        <input type="checkbox" checked={permSet.has(permKey(r, a))} onChange={() => togglePerm(r, a)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] cursor-pointer" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">{permSet.size} de {RESOURCES.length * ACTIONS.length} permisos seleccionados</p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/settings/roles")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Crear Rol"}
          </button>
        </div>
      </form>
    </div>
  );
}
