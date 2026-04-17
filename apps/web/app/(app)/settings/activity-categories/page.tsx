"use client";

import { useEffect, useState, useCallback } from "react";
import { activityCategoriesApi, type ActivityCategory } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

export default function ActivityCategoriesPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#1F3864");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await activityCategoriesApi.list(false);
      setItems(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setError(null);
    try {
      await activityCategoriesApi.create({ name: newName.trim(), color: newColor });
      setNewName("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Error al crear la categoría");
    }
  }

  async function toggleActive(c: ActivityCategory) {
    try {
      await activityCategoriesApi.update(c.id, { active: !c.active });
      await load();
    } catch (e: any) {
      setError(e.message ?? "Error al actualizar la categoría");
    }
  }

  async function remove(c: ActivityCategory) {
    try {
      await activityCategoriesApi.remove(c.id);
      await load();
    } catch (e: any) {
      const msg: string = e.message ?? "";
      alert(
        msg.toLowerCase().includes("asociad") || msg.includes("409")
          ? "La categoría tiene actividades asociadas. Desactívala en vez de eliminarla."
          : msg || "Error al eliminar la categoría"
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Categorías de actividad</h1>
            <p className="text-[11px] text-gray-400">Gestionar categorías para el registro de actividades</p>
          </div>
        </div>
      </div>

      {/* Create form */}
      {can("activity-categories", "create") && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Nueva categoría</p>
          <div className="flex gap-2 items-center">
            <input
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
              placeholder="Nombre de la categoría"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) create(); }}
            />
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-gray-500">Color</label>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5"
              />
            </div>
            <button
              onClick={create}
              disabled={!newName.trim()}
              className="px-4 py-1.5 text-[11px] font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Agregar
            </button>
          </div>
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No hay categorías configuradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {items.map((c) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition">
              {/* Color swatch + name */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="inline-block w-5 h-5 rounded shrink-0 border border-black/10"
                  style={{ backgroundColor: c.color ?? "#888888" }}
                />
                <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {/* Active toggle */}
                {can("activity-categories", "update") ? (
                  <button
                    onClick={() => toggleActive(c)}
                    title={c.active ? "Desactivar" : "Activar"}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                      c.active
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {c.active ? "Activa" : "Inactiva"}
                  </button>
                ) : (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {c.active ? "Activa" : "Inactiva"}
                  </span>
                )}

                {/* Delete */}
                {can("activity-categories", "delete") && (
                  <button
                    onClick={() => remove(c)}
                    className="px-2 py-1 text-[11px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition font-medium"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
