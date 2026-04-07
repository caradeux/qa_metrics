"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Tester {
  id: string;
  name: string;
  _count: { records: number };
}

interface Project {
  id: string;
  name: string;
  client: { name: string };
}

export default function TestersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTester, setEditingTester] = useState<Tester | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Tester | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { can } = usePermissions();

  const fetchData = useCallback(async () => {
    try {
      const [proj, testersData] = await Promise.all([
        apiClient<Project>(`/api/projects/${projectId}`),
        apiClient<Tester[]>(`/api/testers?projectId=${projectId}`),
      ]);
      setProject(proj);
      setTesters(testersData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditingTester(null);
    setName("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(tester: Tester) {
    setEditingTester(tester);
    setName(tester.name);
    setError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");

    const url = editingTester ? `/api/testers/${editingTester.id}` : "/api/testers";
    const method = editingTester ? "PUT" : "POST";
    const body = editingTester
      ? { name: name.trim() }
      : { name: name.trim(), projectId };

    try {
      await apiClient(url, {
        method,
        body: JSON.stringify(body),
      });
      setModalOpen(false);
      fetchData();
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
      await apiClient(`/api/testers/${deleteTarget.id}`, { method: "DELETE" });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchData();
  }

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/projects" className="text-sm text-secondary hover:underline">
          ← Volver a Proyectos
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Testers</h1>
          <p className="text-sm text-muted">
            {project?.client.name} / {project?.name}
          </p>
        </div>
        {can("testers", "create") && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition"
          >
            + Nuevo Tester
          </button>
        )}
      </div>

      {testers.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p>No hay testers en este proyecto.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-white text-left text-sm">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Registros</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {testers.map((tester, idx) => (
                <tr
                  key={tester.id}
                  className={`border-t border-border hover:bg-gray-50 transition ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{tester.name}</td>
                  <td className="px-4 py-3 text-muted">{tester._count.records}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {can("testers", "update") && (
                      <button onClick={() => openEdit(tester)} className="text-sm text-secondary hover:underline">
                        Editar
                      </button>
                    )}
                    {can("testers", "delete") && (
                      <button onClick={() => setDeleteTarget(tester)} className="text-sm text-danger hover:underline">
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTester ? "Editar Tester" : "Nuevo Tester"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="Nombre del tester"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Tester"
        message={
          deleteTarget && deleteTarget._count.records > 0
            ? `"${deleteTarget.name}" tiene ${deleteTarget._count.records} registros. No se puede eliminar.`
            : `¿Estas seguro de eliminar "${deleteTarget?.name}"?`
        }
        loading={deleting}
      />
    </div>
  );
}
