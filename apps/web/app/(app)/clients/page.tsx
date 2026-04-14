"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Client {
  id: string;
  name: string;
  createdAt: string;
  _count: { projects: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchClients = useCallback(async () => {
    try {
      const data = await apiClient<Client[]>("/api/clients");
      setClients(data);
    } catch (err) {
      console.error(err);
      setClients([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/clients/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null); fetchClients();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Clientes</h1>
          <p className="text-xs text-gray-400 mt-0.5">{clients.length} registrados</p>
        </div>
        {can("clients", "create") && (
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition-all duration-200 uppercase tracking-wider shadow-sm hover:shadow-md"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </Link>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gradient-to-r from-gray-100 to-gray-50 rounded-md animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No hay clientes registrados</p>
          {can("clients", "create") && (
            <Link href="/clients/new" className="mt-3 inline-block text-xs text-[#2E5FA3] hover:text-[#1F3864] font-medium transition">
              Crear el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Proyectos</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, idx) => (
                <tr
                  key={client.id}
                  className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors duration-150"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-[#1F3864]/5 flex items-center justify-center text-[#1F3864] text-xs font-bold">
                        {client.name.charAt(0)}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-sm text-gray-700">{client._count.projects}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(client.createdAt).toLocaleDateString("es", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {can("clients", "update") && (
                        <Link
                          href={`/clients/${client.id}/edit`}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition-all duration-150 font-medium"
                        >
                          Editar
                        </Link>
                      )}
                      {can("clients", "delete") && (
                        <button
                          onClick={() => setDeleteTarget(client)}
                          className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-150 font-medium"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Cliente"
        message={`Se eliminara "${deleteTarget?.name}" permanentemente.`}
        loading={deleting}
      />
    </div>
  );
}
