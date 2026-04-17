"use client";
import { useEffect, useState } from "react";
import { activitiesApi, activityCategoriesApi, apiClient, type Activity, type ActivityCategory } from "@/lib/api-client";

interface Props {
  testerId: string;
  initial?: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}

interface AssignmentOption {
  id: string;
  story: { title: string };
  status: string;
}

export function ActivityForm({ testerId, initial, onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [assignmentId, setAssignmentId] = useState<string>(initial?.assignmentId ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt.slice(0, 16) ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt.slice(0, 16) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    activityCategoriesApi.list(true).then(setCategories);
    apiClient<AssignmentOption[]>(`/api/assignments?testerId=${testerId}`).then((list) =>
      setAssignments(list.filter((a) => a.status !== "PRODUCTION"))
    );
  }, [testerId]);

  const duration = startAt && endAt
    ? (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000
    : 0;
  const warnLong = duration > 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        testerId,
        categoryId,
        assignmentId: assignmentId || null,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        notes: notes || null,
      };
      if (initial) await activitiesApi.update(initial.id, payload);
      else await activitiesApi.create(payload);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">{initial ? "Editar actividad" : "Nueva actividad"}</h2>

        <label className="block">
          <span className="text-sm">Categoría</span>
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1">
            <option value="">Selecciona…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm">Asignación (opcional)</span>
          <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1">
            <option value="">— transversal —</option>
            {assignments.map((a) => <option key={a.id} value={a.id}>{a.story.title}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">Inicio</span>
            <input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full border rounded px-2 py-1" />
          </label>
          <label className="block">
            <span className="text-sm">Fin</span>
            <input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 w-full border rounded px-2 py-1" />
          </label>
        </div>

        {warnLong && (
          <p className="text-amber-600 text-sm">⚠ La duración supera 8 horas ({duration.toFixed(1)}h).</p>
        )}

        <label className="block">
          <span className="text-sm">Notas</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1" rows={3} />
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 border rounded">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-1 bg-[#1F3864] text-white rounded disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
