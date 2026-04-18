"use client";
import type { OccupationRow } from "@/lib/api-client";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function occupationPill(pct: number, overallocated: boolean) {
  const rounded = Math.round(pct);
  let cls = "bg-amber-50 text-amber-700 ring-amber-200";
  if (overallocated || pct > 100) cls = "bg-red-50 text-red-700 ring-red-200";
  else if (pct >= 60 && pct <= 90) cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums ${cls}`}>
      {rounded}%
      {overallocated && <span className="ml-1 uppercase tracking-wider text-[9px]">sobrecarga</span>}
    </span>
  );
}

export function OccupationTable({
  rows,
  onSelect,
}: {
  rows: OccupationRow[];
  onSelect?: (r: OccupationRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-400">
        Sin testers en el período
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3">Tester</th>
            <th className="px-4 py-3 text-right">Días hábiles</th>
            <th className="px-4 py-3 text-right">Capacidad</th>
            <th className="px-4 py-3 text-right">Actividad</th>
            <th className="px-4 py-3 text-right">Productivo est.</th>
            <th className="px-4 py-3 text-center">Ocupación</th>
            {onSelect && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr
              key={r.testerId}
              className={`transition hover:bg-[#1F3864]/5 ${onSelect ? "cursor-pointer" : ""}`}
              onClick={() => onSelect?.(r)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F3864]/10 text-[11px] font-bold text-[#1F3864]">
                    {initials(r.testerName)}
                  </span>
                  <span className="font-medium text-gray-900">{r.testerName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">{r.workdays}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                {r.capacityHours.toFixed(1)}h
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                {r.activityHours.toFixed(1)}h
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                {r.productiveHoursEstimate.toFixed(1)}h
              </td>
              <td className="px-4 py-3 text-center">{occupationPill(r.occupationPct, r.overallocated)}</td>
              {onSelect && (
                <td className="px-4 py-3 text-right">
                  <span className="text-[11px] font-semibold text-[#1F3864] hover:underline">Ver actividades →</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
