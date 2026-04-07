"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface User { id: string; email: string; name: string; role: string; active: boolean; createdAt: string; }

const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN: { label: "Administrador", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  QA_LEAD: { label: "Jefe QA", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  QA_ANALYST: { label: "Analista QA", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("QA_ANALYST");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { can } = usePermissions();

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiClient<User[]>("/api/users");
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() {
    setEditingUser(null); setName(""); setEmail(""); setPassword(""); setRole("QA_ANALYST"); setError(""); setModalOpen(true);
  }
  function openEdit(user: User) {
    setEditingUser(user); setName(user.name); setEmail(user.email); setPassword(""); setRole(user.role); setError(""); setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || (!editingUser && !password)) { setError("Completa todos los campos"); return; }
    setSaving(true); setError("");

    const body: Record<string, string> = { name, email, role };
    if (password) body.password = password;

    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";
    try {
      await apiClient(url, { method, body: JSON.stringify(body) });
      setModalOpen(false); fetchUsers();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      await apiClient(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify({ active: !user.active }) });
    } catch (err) {
      console.error(err);
    }
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null); fetchUsers();
  }

  const sel = "w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:border-[#4A90D9] focus:ring-1 focus:ring-[#4A90D9]/20 outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Usuarios</h1>
            <p className="text-[11px] text-gray-400">{users.length} registrados</p>
          </div>
        </div>
        {can("users", "create") && (
          <button onClick={openCreate} className="px-4 py-2 text-[11px] font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Usuario
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Rol</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const r = roleLabels[user.role] || roleLabels.QA_ANALYST;
                return (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${user.active ? "bg-[#1F3864]/10 text-[#1F3864]" : "bg-gray-100 text-gray-400"}`}>
                          {user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${user.active ? "text-gray-900" : "text-gray-400"}`}>{user.name}</p>
                          <p className="text-[11px] text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${r.bg} ${r.color}`}>
                        {r.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {can("users", "update") ? (
                        <button onClick={() => toggleActive(user)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition ${user.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.active ? "bg-emerald-500" : "bg-gray-300"}`}/>
                          {user.active ? "Activo" : "Inactivo"}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${user.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.active ? "bg-emerald-500" : "bg-gray-300"}`}/>
                          {user.active ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {can("users", "update") && (
                          <button onClick={() => openEdit(user)} className="px-2 py-1 text-[11px] text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition font-medium">Editar</button>
                        )}
                        {can("users", "delete") && (
                          <button onClick={() => setDeleteTarget(user)} className="px-2 py-1 text-[11px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition font-medium">Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? "Editar Usuario" : "Nuevo Usuario"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nombre completo</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={sel} placeholder="Nombre y Apellido" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={sel} placeholder="correo@empresa.com" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {editingUser ? "Nueva contraseña (dejar vacio para mantener)" : "Contraseña"}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={sel} placeholder="********" required={!editingUser} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "ADMIN", label: "Administrador", desc: "Acceso total", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                { value: "QA_LEAD", label: "Jefe QA", desc: "Gestion y reportes", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                { value: "QA_ANALYST", label: "Analista QA", desc: "Registro de datos", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              ] as const).map(opt => (
                <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${role === opt.value ? "border-[#2E5FA3] bg-[#2E5FA3]/5 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                  <svg className={`w-5 h-5 mb-1.5 ${role === opt.value ? "text-[#2E5FA3]" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={opt.icon}/></svg>
                  <p className={`text-[11px] font-semibold ${role === opt.value ? "text-[#2E5FA3]" : "text-gray-700"}`}>{opt.label}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {error && <div className="pl-3 border-l-2 border-red-400 text-xs text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition disabled:opacity-50 uppercase tracking-wider">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Eliminar Usuario" message={`Se eliminara "${deleteTarget?.name}" permanentemente.`} loading={deleting} />
    </div>
  );
}
