"use client";
import type { Activity } from "@/lib/api-client";

interface Props {
  activities: Activity[];
  onEdit?: (a: Activity) => void;
  onDelete?: (a: Activity) => void;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function hoursOf(a: Activity) {
  return (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 3600000;
}

export function ActivityList({ activities, onEdit, onDelete }: Props) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
        <svg
          className="mx-auto mb-3 h-10 w-10 text-gray-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-600">Sin actividades registradas</p>
        <p className="mt-1 text-xs text-gray-400">
          Usa el botón <span className="font-medium">+ Nueva actividad</span> para registrar reuniones, capacitaciones o traspasos
        </p>
      </div>
    );
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return (
    <ul className="space-y-2">
      {sorted.map((a) => {
        const h = hoursOf(a);
        const color = a.category.color ?? "#6B7280";
        return (
          <li
            key={a.id}
            className="group relative flex overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-[#1F3864]/30 hover:shadow-sm"
          >
            {/* Stripe de color de categoría */}
            <span className="w-1 shrink-0" style={{ backgroundColor: color }} aria-hidden />

            <div className="flex-1 px-4 py-3">
              {/* Fila superior: categoría + horario + horas + acciones */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F3864]">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  {a.category.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-gray-500">
                  {fmtTime(a.startAt)} – {fmtTime(a.endAt)}
                </span>
                <span className="inline-flex items-center rounded-md bg-[#1F3864]/5 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#1F3864]">
                  {h.toFixed(1)}h
                </span>

                {(onEdit || onDelete) && (
                  <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(a)}
                        title="Editar"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1F3864]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(a)}
                        title="Eliminar"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    )}
                  </span>
                )}
              </div>

              {/* Notas */}
              {a.notes && (
                <p className="mt-1 text-[13px] leading-snug text-gray-700">{a.notes}</p>
              )}

              {/* HU asignada */}
              {a.assignment?.story?.title && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {a.assignment.story.title}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
