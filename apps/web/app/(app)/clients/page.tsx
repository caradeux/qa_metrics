"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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

  function openCreate() {
    setEditingClient(null); setName(""); setError(""); setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client); setName(client.name); setError(""); setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      await apiClient(url, { method, body: JSON.stringify({ name: name.trim() }) });
      setModalOpen(false); fetchClients();
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

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
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition-all duration-200 uppercase tracking-wider shadow-sm hover:shadow-md"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </button>
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
            <button onClick={openCreate} className="mt-3 text-xs text-[#2E5FA3] hover:text-[#1F3864] font-medium transition">
              Crear el primero
            </button>
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
                        <button
                          onClick={() => openEdit(client)}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition-all duration-150 font-medium"
                        >
                          Editar
                        </button>
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

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}>
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-0 py-2.5 bg-transparent text-gray-900 text-sm border-0 border-b-2 border-gray-200 focus:border-[#2E5FA3] focus:ring-0 transition-colors duration-200 placeholder-gray-300 outline-none"
              placeholder="Nombre del cliente"
              autoFocus
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 pl-3 border-l-2 border-red-400 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-all duration-150"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-medium text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition-all duration-200 disabled:opacity-50 uppercase tracking-wider"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

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
