"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface User { id: string; email: string; name: string; role: string; }

const ROLE_OPTS = [
  { value: "ADMIN", label: "Administrador", desc: "Acceso total", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { value: "QA_LEAD", label: "Jefe QA", desc: "Gestion y reportes", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { value: "QA_ANALYST", label: "Analista QA", desc: "Registro de datos", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
] as const;

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("QA_ANALYST");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<User[]>("/api/users")
      .then((list) => {
        const u = list.find((x) => x.id === id);
        if (u) { setName(u.name); setEmail(u.email); setRole(u.role); }
        else setError("Usuario no encontrado");
        setLoaded(true);
      })
      .catch((err) => { setError(err.message || "Error al cargar"); setLoaded(true); });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) { setError("Completa todos los campos"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, email, role }),
      });
      router.push("/users");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Editar Usuario</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre completo</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Rol</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                className={`p-3 rounded-lg border text-left transition-all ${role === opt.value ? "border-[#2E5FA3] bg-[#2E5FA3]/5 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                <svg className={`w-5 h-5 mb-1.5 ${role === opt.value ? "text-[#2E5FA3]" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} /></svg>
                <p className={`text-[11px] font-semibold ${role === opt.value ? "text-[#2E5FA3]" : "text-gray-700"}`}>{opt.label}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/users")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
