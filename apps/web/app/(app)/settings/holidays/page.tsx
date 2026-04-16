"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { Modal } from "@/components/ui/Modal";

interface Holiday {
  date: string; // ISO
  name: string;
}

function fmtDate(iso: string): string {
  // Parseo local (YYYY-MM-DD) para evitar corrimiento por zona horaria
  const ymd = iso.slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  const local = new Date(y!, m! - 1, d!);
  return local.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
}

function isoOnly(iso: string): string {
  return iso.slice(0, 10);
}

export default function HolidaysPage() {
  const { can } = usePermissions();
  const canCreate = can("holidays", "create");
  const canUpdate = can("holidays", "update");
  const canDelete = can("holidays", "delete");

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulario crear/editar
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Confirm delete
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  async function fetchHolidays() {
    setLoading(true); setError("");
    try {
      const data = await apiClient<Holiday[]>(`/api/holidays?year=${year}`);
      setItems(data);
    } catch (err: any) {
      setError(err?.message || "Error al cargar feriados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchHolidays(); /* eslint-disable-next-line */ }, [year]);

  function openCreate() {
    setFormMode("create");
    setFormDate(`${year}-01-01`);
    setFormName("");
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(h: Holiday) {
    setFormMode("edit");
    setFormDate(isoOnly(h.date));
    setFormName(h.name);
    setFormError("");
    setFormOpen(true);
  }

  async function saveForm() {
    if (!formName.trim()) { setFormError("Nombre requerido"); return; }
    setSaving(true); setFormError("");
    try {
      if (formMode === "create") {
        await apiClient("/api/holidays", {
          method: "POST",
          body: JSON.stringify({ date: formDate, name: formName.trim() }),
        });
      } else {
        await apiClient(`/api/holidays/${formDate}`, {
          method: "PUT",
          body: JSON.stringify({ name: formName.trim() }),
        });
      }
      setFormOpen(false);
      await fetchHolidays();
    } catch (err: any) {
      setFormError(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient(`/api/holidays/${isoOnly(deleting.date)}`, { method: "DELETE" });
      setDeleting(null);
      await fetchHolidays();
    } catch (err: any) {
      alert(err?.message || "Error al eliminar");
    }
  }

  const yearOptions = useMemo(() => {
    const opts: number[] = [];
    for (let y = currentYear + 2; y >= currentYear - 3; y--) opts.push(y);
    return opts;
  }, [currentYear]);

  const inp = "px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Feriados</h1>
      <p className="text-sm text-muted mb-6">
        Calendario de feriados legales aplicable a la planificación del Gantt y a las validaciones de días hábiles.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6 bg-card p-4 rounded-xl border border-border">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Año</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inp}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition"
          >
            + Nuevo feriado
          </button>
        )}
        <div className="ml-auto text-xs text-gray-500">
          {loading ? "Cargando…" : `${items.length} feriado(s) en ${year}`}
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-40">Fecha</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay feriados cargados para {year}.
                </td>
              </tr>
            )}
            {items.map((h, idx) => (
              <tr key={h.date} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} border-b border-gray-100 last:border-b-0 hover:bg-gray-50`}>
                <td className="px-4 py-2.5 text-xs font-mono text-gray-700 whitespace-nowrap">
                  {isoOnly(h.date)}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-800">
                  <div>{h.name}</div>
                  <div className="text-[11px] text-gray-400">{fmtDate(h.date)}</div>
                </td>
                <td className="px-4 py-2.5 text-right space-x-1">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => openEdit(h)}
                      className="px-2.5 py-1 text-[11px] font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleting(h)}
                      className="px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "create" ? "Nuevo feriado" : "Editar feriado"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Fecha</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              disabled={formMode === "edit"}
              className={`${inp} w-full disabled:bg-gray-50 disabled:text-gray-400`}
            />
            {formMode === "edit" && (
              <p className="text-[10px] text-gray-400 mt-1">La fecha no puede cambiar (es la clave del registro). Para mover el feriado, elimínalo y crea uno nuevo.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Nombre</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className={`${inp} w-full`}
              placeholder="Ej: Día del Trabajo"
            />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveForm}
              disabled={saving || !formName.trim() || !formDate}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar feriado"
      >
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              ¿Seguro que quieres eliminar <span className="font-semibold">{deleting.name}</span> del {isoOnly(deleting.date)}?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border-l-4 border-amber-300 px-3 py-2 rounded-r">
              Al eliminarlo, las validaciones de días hábiles lo tratarán como día laboral.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleting(null)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
