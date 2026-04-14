"use client";

import { useEffect, useState } from "react";
import { startOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";

interface DayRow {
  date: string;
  designed: number;
  executed: number;
  defects: number;
  isHoliday: boolean;
  holidayName: string | null;
  isFuture: boolean;
}

interface Props {
  testerId: string;
  cycleId: string;
  weekStart: Date;
  onSaved?: () => void;
}

export function WeeklyGrid({ testerId, cycleId, weekStart, onSaved }: Props) {
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const mondayStr = format(monday, "yyyy-MM-dd");
  const [days, setDays] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    setError(null);
    apiClient<{ weekStart: string; days: DayRow[] }>(
      `/api/daily-records?testerId=${testerId}&weekStart=${mondayStr}`
    )
      .then((r) => {
        setDays(r.days);
        setDirty(false);
      })
      .catch((e: any) => setError(e?.message ?? "Error al cargar"));
  }, [testerId, mondayStr]);

  const update = (
    idx: number,
    field: "designed" | "executed" | "defects",
    value: number
  ) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === idx ? { ...d, [field]: Math.max(0, value | 0) } : d
      )
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = days
        .filter((d) => !d.isHoliday && !d.isFuture)
        .map((d) => ({
          date: d.date,
          designed: d.designed,
          executed: d.executed,
          defects: d.defects,
        }));
      await apiClient("/api/daily-records/bulk", {
        method: "POST",
        body: JSON.stringify({ testerId, cycleId, days: payload }),
      });
      setDirty(false);
      setLastSaved(new Date());
      onSaved?.();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const total = days.reduce(
    (a, d) => ({
      designed: a.designed + d.designed,
      executed: a.executed + d.executed,
      defects: a.defects + d.defects,
    }),
    { designed: 0, executed: 0, defects: 0 }
  );

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1F3864] text-white">
            <th className="p-2 text-left">Día</th>
            <th className="p-2">Diseñados</th>
            <th className="p-2">Ejecutados</th>
            <th className="p-2">Defectos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => {
            const disabled = d.isHoliday || d.isFuture;
            return (
              <tr
                key={d.date}
                className={
                  disabled ? "bg-gray-100 text-gray-400" : "odd:bg-gray-50"
                }
              >
                <td className="p-2">
                  <span className="capitalize">
                    {format(new Date(d.date + "T12:00:00"), "EEEE d MMM", {
                      locale: es,
                    })}
                  </span>
                  {d.isHoliday && (
                    <span className="ml-2 rounded bg-yellow-200 px-2 py-0.5 text-xs text-yellow-900">
                      Feriado: {d.holidayName}
                    </span>
                  )}
                  {d.isFuture && !d.isHoliday && (
                    <span className="ml-2 text-xs text-gray-500">(futuro)</span>
                  )}
                </td>
                {(["designed", "executed", "defects"] as const).map((f) => (
                  <td key={f} className="p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      disabled={disabled}
                      value={d[f]}
                      onChange={(e) => update(i, f, Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 p-1 text-center disabled:bg-gray-200"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="bg-[#2E5FA3] font-semibold text-white">
            <td className="p-2">Total semana</td>
            <td className="p-2 text-center">{total.designed}</td>
            <td className="p-2 text-center">{total.executed}</td>
            <td className="p-2 text-center">{total.defects}</td>
          </tr>
        </tbody>
      </table>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded bg-[#1F3864] px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar semana"}
        </button>
        {lastSaved && (
          <span className="text-xs text-gray-500">
            Guardado {lastSaved.toLocaleTimeString("es-CL")}
          </span>
        )}
      </div>
    </div>
  );
}
