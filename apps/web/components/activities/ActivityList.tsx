"use client";
import type { Activity } from "@/lib/api-client";
import { CategoryBadge } from "./CategoryBadge";

interface Props {
  activities: Activity[];
  onEdit?: (a: Activity) => void;
  onDelete?: (a: Activity) => void;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function hours(a: Activity) {
  return (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 3600000;
}

export function ActivityList({ activities, onEdit, onDelete }: Props) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-500">Sin actividades registradas.</p>;
  }
  const total = activities.reduce((acc, a) => acc + hours(a), 0);
  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-600">
          <tr>
            <th className="py-1">Horario</th>
            <th>Categoría</th>
            <th>Asignación</th>
            <th>Notas</th>
            <th className="text-right">Horas</th>
            {(onEdit || onDelete) && <th></th>}
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-1">{fmtTime(a.startAt)}–{fmtTime(a.endAt)}</td>
              <td><CategoryBadge category={a.category} /></td>
              <td className="text-gray-700">{a.assignment?.story.title ?? "—"}</td>
              <td className="text-gray-500 truncate max-w-[200px]">{a.notes ?? ""}</td>
              <td className="text-right">{hours(a).toFixed(1)}</td>
              {(onEdit || onDelete) && (
                <td className="text-right whitespace-nowrap">
                  {onEdit && <button onClick={() => onEdit(a)} className="text-blue-600 hover:underline mr-2">Editar</button>}
                  {onDelete && <button onClick={() => onDelete(a)} className="text-red-600 hover:underline">Eliminar</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td colSpan={4} className="pt-2 text-right">Total:</td>
            <td className="pt-2 text-right">{total.toFixed(1)}h</td>
            {(onEdit || onDelete) && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
