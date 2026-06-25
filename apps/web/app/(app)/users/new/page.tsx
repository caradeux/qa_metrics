"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const ROLE_META: Record<string, { label: string; desc: string; icon: string }> = {
  ADMIN: { label: "Administrador", desc: "Acceso total", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  QA_LEAD: { label: "Jefe QA", desc: "Gestion y reportes", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  QA_ANALYST: { label: "Analista QA", desc: "Registro de datos", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  CLIENT_PM: { label: "Jefe Cliente", desc: "Solo ver proyectos", icon: "M12 4v16m8-8H4" },
};

interface Role { id: string; name: string }
interface ClientOpt { id: string; name: string }
type Specialty = "QA_MANUAL" | "QA_AUTOMATION" | "PERFORMANCE";
const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: "QA_MANUAL", label: "QA Manual" },
  { value: "QA_AUTOMATION", label: "QA Automatizado" },
  { value: "PERFORMANCE", label: "Performance" },
];

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState<string>("");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const roleName = roles.find((r) => r.id === roleId)?.name;

  useEffect(() => {
    Promise.all([
      apiClient<Role[]>("/api/roles"),
      apiClient<ClientOpt[]>("/api/clients"),
    ])
      .then(([rs, cls]) => {
        setRoles(rs);
        setClients(cls);
        const analyst = rs.find((r) => r.name === "QA_ANALYST") ?? rs[0];
        if (analyst) setRoleId(analyst.id);
      })
      .catch(() => setError("No se pudieron cargar los roles"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) { setError("Completa todos los campos"); return; }
    if (!roleId) { setError("Selecciona un rol"); return; }
    setSaving(true); setError("");
    try {
      await apiClient("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name, email, password, roleId,
          ...(roleName === "QA_ANALYST" ? { specialties, clientIds } : { specialties: [], clientIds: [] }),
        }),
      });
      router.push("/users");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Nuevo Usuario</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre completo</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Nombre y Apellido" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="correo@empresa.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="********" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Rol</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {roles.map((r) => {
              const meta = ROLE_META[r.name] ?? { label: r.name, desc: "", icon: ROLE_META.QA_ANALYST.icon };
              const active = roleId === r.id;
              return (
                <button key={r.id} type="button" onClick={() => setRoleId(r.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                  <svg className={`w-5 h-5 mb-1.5 ${active ? "text-[#2E5FA3]" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} /></svg>
                  <p className={`text-[11px] font-semibold ${active ? "text-[#2E5FA3]" : "text-gray-700"}`}>{meta.label}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{meta.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
        {roleName === "QA_ANALYST" && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Especialidades</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SPECIALTIES.map((s) => {
                  const active = specialties.includes(s.value);
                  return (
                    <label key={s.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5" : "border-gray-200"}`}>
                      <input type="checkbox" checked={active} className="h-4 w-4 accent-[#1F3864]"
                        onChange={(e) => setSpecialties((prev) => e.target.checked ? [...prev, s.value] : prev.filter((x) => x !== s.value))} />
                      <span className="text-sm text-foreground">{s.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Clientes asociados</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto p-1">
                {clients.map((c) => {
                  const active = clientIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5" : "border-gray-200"}`}>
                      <input type="checkbox" checked={active} className="h-4 w-4 accent-[#1F3864]"
                        onChange={(e) => setClientIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
                      <span className="text-sm text-foreground">{c.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">El analista solo podrá ser asignado a proyectos de los clientes seleccionados.</p>
            </div>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/users")} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
            {saving ? "Guardando..." : "Crear Usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
