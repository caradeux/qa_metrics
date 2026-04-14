"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Permission { resource: string; action: string; }
interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions: Permission[];
  _count: { users: number };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchRoles = useCallback(async () => {
    try {
      const data = await apiClient<Role[]>("/api/roles");
      setRoles(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/roles/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchRoles();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Roles y Permisos</h1>
            <p className="text-[11px] text-gray-400">Gestionar roles y permisos del sistema</p>
          </div>
        </div>
        {can("roles", "create") && (
          <Link href="/settings/roles/new" className="px-4 py-2 text-[11px] font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Rol
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (<div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />))}
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No hay roles configurados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between hover:border-gray-300 transition">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#1F3864]/10 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-[#1F3864]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{role.name}</p>
                    {role.isSystem && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wider">Sistema</span>
                    )}
                  </div>
                  {role.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{role.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                  {role._count.users} <span className="font-sans">{role._count.users === 1 ? "usuario" : "usuarios"}</span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                  {role.permissions.length} <span className="font-sans">permisos</span>
                </span>
                <div className="inline-flex gap-1">
                  {can("roles", "update") && (
                    <Link href={`/settings/roles/${role.id}/edit`} className="px-2 py-1 text-[11px] text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition font-medium">
                      Editar
                    </Link>
                  )}
                  {can("roles", "delete") && !role.isSystem && role._count.users === 0 && (
                    <button onClick={() => setDeleteTarget(role)} className="px-2 py-1 text-[11px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition font-medium">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Rol"
        message={`Se eliminara el rol "${deleteTarget?.name}" permanentemente.`}
        loading={deleting}
      />
    </div>
  );
}
