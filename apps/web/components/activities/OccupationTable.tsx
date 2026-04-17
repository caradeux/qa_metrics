"use client";
import type { OccupationRow } from "@/lib/api-client";

export function OccupationTable({ rows, onSelect }: { rows: OccupationRow[]; onSelect?: (r: OccupationRow) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-gray-600">
        <tr>
          <th className="py-1">Tester</th>
          <th>Días hábiles</th>
          <th>Capacidad (h)</th>
          <th>Actividad (h)</th>
          <th>Productivo est. (h)</th>
          <th>Ocupación</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.testerId} className="border-t hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect?.(r)}>
            <td className="py-1 font-medium">{r.testerName}</td>
            <td>{r.workdays}</td>
            <td>{r.capacityHours.toFixed(1)}</td>
            <td>{r.activityHours.toFixed(1)}</td>
            <td>{r.productiveHoursEstimate.toFixed(1)}</td>
            <td>
              {r.occupationPct.toFixed(0)}%
              {r.overallocated && <span className="ml-2 text-red-600 text-xs">sobrecarga</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
