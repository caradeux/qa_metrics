"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiClient<User[]>("/api/users");
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
          <Link href="/users/new" className="px-4 py-2 text-[11px] font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Usuario
          </Link>
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
                          <Link href={`/users/${user.id}/edit`} className="px-2 py-1 text-[11px] text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition font-medium">Editar</Link>
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

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Eliminar Usuario" message={`Se eliminara "${deleteTarget?.name}" permanentemente.`} loading={deleting} />
    </div>
  );
}
