"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

// ── Types ──────────────────────────────────────────────
interface Permission {
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions: Permission[];
  _count: { users: number };
}

// ── Constants ──────────────────────────────────────────
const RESOURCES = [
  "users",
  "roles",
  "clients",
  "projects",
  "cycles",
  "testers",
  "records",
  "assignments",
  "reports",
] as const;

const ACTIONS = ["create", "read", "update", "delete"] as const;

const RESOURCE_LABELS: Record<string, string> = {
  users: "Usuarios",
  roles: "Roles",
  clients: "Clientes",
  projects: "Proyectos",
  cycles: "Ciclos",
  testers: "Testers",
  records: "Registros",
  assignments: "Asignaciones",
  reports: "Reportes",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Crear",
  read: "Ver",
  update: "Editar",
  delete: "Eliminar",
};

// ── Helpers ────────────────────────────────────────────
function permKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function buildPermSet(permissions: Permission[]): Set<string> {
  return new Set(permissions.map((p) => permKey(p.resource, p.action)));
}

function permSetToArray(permSet: Set<string>): Permission[] {
  return Array.from(permSet).map((k) => {
    const [resource, action] = k.split(":");
    return { resource, action };
  });
}

// ── Component ──────────────────────────────────────────
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { can } = usePermissions();

  // ── Data fetching ──
  const fetchRoles = useCallback(async () => {
    try {
      const data = await apiClient<Role[]>("/api/roles");
      setRoles(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // ── Modal helpers ──
  function openCreate() {
    setEditingRole(null);
    setName("");
    setDescription("");
    setPermSet(new Set());
    setError("");
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description || "");
    setPermSet(buildPermSet(role.permissions));
    setError("");
    setModalOpen(true);
  }

  // ── Permission matrix toggles ──
  function togglePerm(resource: string, action: string) {
    setPermSet((prev) => {
      const next = new Set(prev);
      const key = permKey(resource, action);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleRow(resource: string) {
    const allChecked = ACTIONS.every((a) => permSet.has(permKey(resource, a)));
    setPermSet((prev) => {
      const next = new Set(prev);
      ACTIONS.forEach((a) => {
        const key = permKey(resource, a);
        if (allChecked) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  function toggleColumn(action: string) {
    const allChecked = RESOURCES.every((r) => permSet.has(permKey(r, action)));
    setPermSet((prev) => {
      const next = new Set(prev);
      RESOURCES.forEach((r) => {
        const key = permKey(r, action);
        if (allChecked) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  function toggleAll() {
    const total = RESOURCES.length * ACTIONS.length;
    const allChecked = permSet.size === total;
    if (allChecked) {
      setPermSet(new Set());
    } else {
      const next = new Set<string>();
      RESOURCES.forEach((r) => ACTIONS.forEach((a) => next.add(permKey(r, a))));
      setPermSet(next);
    }
  }

  // ── Save ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (permSet.size === 0) {
      setError("Selecciona al menos un permiso");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: permSetToArray(permSet),
    };

    const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
    const method = editingRole ? "PUT" : "POST";

    try {
      await apiClient(url, { method, body: JSON.stringify(body) });
      setModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
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

  // ── Derived ──
  const isAllRowChecked = (resource: string) =>
    ACTIONS.every((a) => permSet.has(permKey(resource, a)));
  const isAllColumnChecked = (action: string) =>
    RESOURCES.every((r) => permSet.has(permKey(r, action)));
  const isAllChecked = permSet.size === RESOURCES.length * ACTIONS.length;

  const inputCls =
    "w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:border-[#4A90D9] focus:ring-1 focus:ring-[#4A90D9]/20 outline-none";

  // ── Render ──
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Roles y Permisos
            </h1>
            <p className="text-[11px] text-gray-400">
              Gestionar roles y permisos del sistema
            </p>
          </div>
        </div>
        {can("roles", "create") && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-[11px] font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition uppercase tracking-wider inline-flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nuevo Rol
          </button>
        )}
      </div>

      {/* Role cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No hay roles configurados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between hover:border-gray-300 transition"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[#1F3864]/10 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4.5 h-4.5 text-[#1F3864]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                {/* Info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {role.name}
                    </p>
                    {role.isSystem && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wider">
                        Sistema
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {role.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 ml-4">
                {/* User count */}
                <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                  {role._count.users}{" "}
                  <span className="font-sans">
                    {role._count.users === 1 ? "usuario" : "usuarios"}
                  </span>
                </span>
                {/* Permissions count */}
                <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                  {role.permissions.length}{" "}
                  <span className="font-sans">permisos</span>
                </span>
                {/* Actions */}
                <div className="inline-flex gap-1">
                  {can("roles", "update") && (
                    <button
                      onClick={() => openEdit(role)}
                      className="px-2 py-1 text-[11px] text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition font-medium"
                    >
                      Editar
                    </button>
                  )}
                  {can("roles", "delete") &&
                    !role.isSystem &&
                    role._count.users === 0 && (
                      <button
                        onClick={() => setDeleteTarget(role)}
                        className="px-2 py-1 text-[11px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition font-medium"
                      >
                        Eliminar
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRole ? "Editar Rol" : "Nuevo Rol"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Nombre del rol
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Ej: Supervisor"
              autoFocus
              disabled={editingRole?.isSystem}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Descripcion
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Descripcion breve del rol"
              disabled={editingRole?.isSystem}
            />
          </div>

          {/* Permission Matrix */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Matriz de permisos
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-40">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllChecked}
                          onChange={toggleAll}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] focus:ring-[#4A90D9]/20 cursor-pointer"
                          disabled={editingRole?.isSystem}
                        />
                        Recurso
                      </label>
                    </th>
                    {ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-2 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                      >
                        <label className="flex flex-col items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAllColumnChecked(action)}
                            onChange={() => toggleColumn(action)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] focus:ring-[#4A90D9]/20 cursor-pointer"
                            disabled={editingRole?.isSystem}
                          />
                          {ACTION_LABELS[action]}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource, idx) => (
                    <tr
                      key={resource}
                      className={`${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      } border-b border-gray-100 last:border-b-0`}
                    >
                      <td className="px-3 py-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAllRowChecked(resource)}
                            onChange={() => toggleRow(resource)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] focus:ring-[#4A90D9]/20 cursor-pointer"
                            disabled={editingRole?.isSystem}
                          />
                          <span className="text-xs font-medium text-gray-700">
                            {RESOURCE_LABELS[resource]}
                          </span>
                        </label>
                      </td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={permSet.has(permKey(resource, action))}
                            onChange={() => togglePerm(resource, action)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-[#1F3864] focus:ring-[#4A90D9]/20 cursor-pointer"
                            disabled={editingRole?.isSystem}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {permSet.size} de {RESOURCES.length * ACTIONS.length} permisos
              seleccionados
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="pl-3 border-l-2 border-red-400 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition"
            >
              {editingRole?.isSystem ? "Cerrar" : "Cancelar"}
            </button>
            {!editingRole?.isSystem && (
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] transition disabled:opacity-50 uppercase tracking-wider"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
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
