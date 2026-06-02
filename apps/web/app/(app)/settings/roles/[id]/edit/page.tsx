"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { permKey } from "@/lib/permissions";
import { PermissionMatrix } from "@/components/roles/PermissionMatrix";

interface Permission { resource: string; action: string; }
interface Role { id: string; name: string; description: string | null; isSystem: boolean; permissions: Permission[]; }

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<Role[]>("/api/roles")
      .then((list) => {
        const r = list.find((x) => x.id === id);
        if (r) {
          setRole(r); setName(r.name); setDescription(r.description || "");
          setPermSet(new Set(r.permissions.map((p) => permKey(p.resource, p.action))));
        } else setError("Rol no encontrado");
        setLoaded(true);
      })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (permSet.size === 0) { setError("Selecciona al menos un permiso"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/roles/${id}`, {
        method: "PUT",
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

  if (!loaded) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;

  const inp = "w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-4xl animate-fadeInUp">
      <div className="mb-6">
        <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Configuración · Roles</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">Editar rol{role ? `: ${role.name}` : ""}</h1>
          {role?.isSystem && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Sistema</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Define qué puede ver y hacer este rol en cada módulo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre del rol</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inp} placeholder="Descripción breve del rol" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Matriz de permisos</label>
          <PermissionMatrix value={permSet} onChange={setPermSet} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => router.push("/settings/roles")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
