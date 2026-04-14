"use client";

import { useEffect, useMemo, useState } from "react";
import { startOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/stories/StatusBadge";

interface DayInfo {
  date: string;
  isHoliday: boolean;
  holidayName: string | null;
  isFuture: boolean;
}

interface AssignmentRecord {
  date: string;
  designed: number;
  executed: number;
  defects: number;
}

interface AssignmentRow {
  id: string;
  story: { id: string; title: string; externalId: string | null };
  cycle: { id: string; name: string };
  status: string;
  startDate: string;
  endDate: string | null;
  activeOnDates: string[];
  records: AssignmentRecord[];
}

interface ApiResponse {
  weekStart: string;
  days: DayInfo[];
  assignments: AssignmentRow[];
}

interface CellValue {
  designed: number;
  executed: number;
  defects: number;
}

type DraftMap = Record<string, Record<string, CellValue>>;

interface Props {
  testerId: string;
  weekStart: Date;
  onSaved?: () => void;
}

const EMPTY_CELL: CellValue = { designed: 0, executed: 0, defects: 0 };

const FIELD_META = {
  designed: {
    short: "D",
    label: "Diseñados",
    description: "Casos de prueba diseñados",
    color: "#2E5FA3",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  executed: {
    short: "E",
    label: "Ejecutados",
    description: "Casos de prueba ejecutados",
    color: "#0891b2",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  defects: {
    short: "B",
    label: "Bugs",
    description: "Defectos detectados",
    color: "#dc2626",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
} as const;

function buildDraft(assignments: AssignmentRow[]): DraftMap {
  const out: DraftMap = {};
  for (const a of assignments) {
    out[a.id] = {};
    for (const r of a.records) {
      out[a.id]![r.date] = {
        designed: r.designed,
        executed: r.executed,
        defects: r.defects,
      };
    }
  }
  return out;
}

function cellEquals(a: CellValue, b: CellValue) {
  return (
    a.designed === b.designed && a.executed === b.executed && a.defects === b.defects
  );
}

export function WeeklyGrid({ testerId, weekStart, onSaved }: Props) {
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const mondayStr = format(monday, "yyyy-MM-dd");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [initial, setInitial] = useState<DraftMap>({});
  const [draft, setDraft] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const load = () => {
    setError(null);
    apiClient<ApiResponse>(
      `/api/daily-records?testerId=${testerId}&weekStart=${mondayStr}`
    )
      .then((r) => {
        setData(r);
        const d = buildDraft(r.assignments);
        setInitial(d);
        setDraft(JSON.parse(JSON.stringify(d)));
      })
      .catch((e: any) => setError(e?.message ?? "Error al cargar"));
  };

  useEffect(load, [testerId, mondayStr]);

  const dirty = useMemo(() => {
    for (const aid of Object.keys(draft)) {
      const cur = draft[aid] ?? {};
      const init = initial[aid] ?? {};
      const keys = new Set([...Object.keys(cur), ...Object.keys(init)]);
      for (const k of keys) {
        const a = cur[k] ?? EMPTY_CELL;
        const b = init[k] ?? EMPTY_CELL;
        if (!cellEquals(a, b)) return true;
      }
    }
    return false;
  }, [draft, initial]);

  const getCell = (assignmentId: string, date: string): CellValue =>
    draft[assignmentId]?.[date] ?? EMPTY_CELL;

  const setCell = (
    assignmentId: string,
    date: string,
    field: keyof CellValue,
    value: number
  ) => {
    setDraft((prev) => {
      const next = { ...prev };
      const row = { ...(next[assignmentId] ?? {}) };
      const cell = { ...(row[date] ?? EMPTY_CELL) };
      cell[field] = Math.max(0, value | 0);
      row[date] = cell;
      next[assignmentId] = row;
      return next;
    });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const entries: Array<
        { assignmentId: string; date: string } & CellValue
      > = [];
      for (const a of data.assignments) {
        for (const day of data.days) {
          if (day.isHoliday || day.isFuture) continue;
          if (!a.activeOnDates.includes(day.date)) continue;
          const cur = getCell(a.id, day.date);
          const init = initial[a.id]?.[day.date] ?? EMPTY_CELL;
          if (!cellEquals(cur, init)) {
            entries.push({
              assignmentId: a.id,
              date: day.date,
              designed: cur.designed,
              executed: cur.executed,
              defects: cur.defects,
            });
          }
        }
      }
      if (entries.length === 0) {
        setSaving(false);
        return;
      }
      await apiClient("/api/daily-records/bulk", {
        method: "POST",
        body: JSON.stringify({ testerId, entries }),
      });
      setLastSaved(new Date());
      load();
      onSaved?.();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm text-sm text-gray-500">
        {error ?? "Cargando..."}
      </div>
    );
  }

  if (data.assignments.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm text-sm text-gray-600">
        No hay HUs activas esta semana para este tester. Asigna al tester a una
        HU desde el detalle del proyecto.
      </div>
    );
  }

  // Per-row totals + per-day totals
  const dayTotals: Record<string, CellValue> = {};
  for (const d of data.days) dayTotals[d.date] = { ...EMPTY_CELL };

  const rowTotals: Record<string, CellValue> = {};
  for (const a of data.assignments) {
    rowTotals[a.id] = { ...EMPTY_CELL };
    for (const day of data.days) {
      if (!a.activeOnDates.includes(day.date)) continue;
      const c = getCell(a.id, day.date);
      rowTotals[a.id]!.designed += c.designed;
      rowTotals[a.id]!.executed += c.executed;
      rowTotals[a.id]!.defects += c.defects;
      dayTotals[day.date]!.designed += c.designed;
      dayTotals[day.date]!.executed += c.executed;
      dayTotals[day.date]!.defects += c.defects;
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      {/* Leyenda */}
      <div className="mb-3 flex flex-wrap items-center gap-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-500">Leyenda</span>
        {(["designed", "executed", "defects"] as const).map((f) => {
          const m = FIELD_META[f];
          return (
            <span key={f} className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded" style={{ color: m.color, backgroundColor: `${m.color}15` }}>
                {m.icon}
              </span>
              <span className="font-semibold" style={{ color: m.color }}>{m.short}</span>
              <span>= {m.label}</span>
              <span className="text-gray-400">({m.description})</span>
            </span>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1F3864] text-white">
              <th
                className="sticky left-0 z-10 bg-[#1F3864] p-2 text-left"
                style={{ minWidth: 260, width: 260 }}
              >
                HU / Ciclo
              </th>
              {data.days.map((d) => (
                <th
                  key={d.date}
                  className={`p-2 text-center ${
                    d.isHoliday ? "bg-yellow-400 text-yellow-900" : ""
                  }`}
                  style={{ minWidth: 140 }}
                >
                  <div className="capitalize">
                    {format(new Date(d.date + "T12:00:00"), "EEE dd MMM", {
                      locale: es,
                    })}
                  </div>
                  {d.isHoliday && (
                    <div className="mt-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-normal text-yellow-900">
                      {d.holidayName}
                    </div>
                  )}
                </th>
              ))}
              <th
                className="sticky right-0 z-10 bg-[#1F3864] p-2 text-center"
                style={{ minWidth: 100 }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.assignments.map((a) => (
              <tr key={a.id} className="border-b">
                <td
                  className="sticky left-0 z-10 bg-white p-2 align-top"
                  style={{ minWidth: 260, width: 260 }}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold text-[#1F3864]">
                      {a.story.externalId ? (
                        <span className="mr-1 text-xs text-gray-500">
                          #{a.story.externalId}
                        </span>
                      ) : null}
                      {a.story.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                        {a.cycle.name}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                </td>
                {data.days.map((day) => {
                  const active = a.activeOnDates.includes(day.date);
                  const disabled =
                    !active || day.isHoliday || day.isFuture;
                  const cell = getCell(a.id, day.date);
                  return (
                    <td
                      key={day.date}
                      className={`p-1 align-top ${
                        disabled ? "bg-gray-100" : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        {(["designed", "executed", "defects"] as const).map((field) => {
                          const m = FIELD_META[field];
                          return (
                            <label
                              key={field}
                              className="flex items-center gap-1 text-xs text-gray-600"
                              title={`${m.label} (${m.description})`}
                            >
                              <span className="inline-flex items-center gap-0.5" style={{ color: m.color }}>
                                {m.icon}
                                <span className="font-semibold">{m.short}</span>
                              </span>
                              <input
                                type="number"
                                min={0}
                                disabled={disabled}
                                value={cell[field]}
                                onChange={(e) =>
                                  setCell(a.id, day.date, field, Number(e.target.value))
                                }
                                className="w-14 rounded border border-gray-300 px-1 py-0.5 text-center text-xs disabled:bg-gray-200 disabled:text-gray-400"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
                <td
                  className="sticky right-0 z-10 bg-gradient-to-l from-slate-100 to-slate-50 p-2 align-top border-l-2 border-slate-200"
                  style={{ minWidth: 110 }}
                >
                  <div className="flex flex-col gap-1">
                    {(["designed", "executed", "defects"] as const).map((f) => {
                      const m = FIELD_META[f];
                      const val = rowTotals[a.id]![f as keyof CellValue];
                      const isZero = val === 0;
                      return (
                        <div
                          key={f}
                          className={`flex items-center justify-between gap-1.5 rounded-md px-2 py-0.5 text-xs ${isZero ? "bg-white/60 text-gray-400" : "bg-white shadow-sm"}`}
                          style={isZero ? {} : { color: m.color, border: `1px solid ${m.color}33` }}
                          title={m.label}
                        >
                          <span className="inline-flex items-center gap-1">
                            {m.icon}
                            <span className="text-[10px] font-semibold">{m.short}</span>
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] text-white">
              <td
                className="sticky left-0 z-10 bg-[#1F3864] p-3 font-bold uppercase tracking-wider text-[11px]"
                style={{ minWidth: 260, width: 260 }}
              >
                Total del día
              </td>
              {data.days.map((day) => (
                <td key={day.date} className="p-2 text-center">
                  <div className="flex flex-col items-stretch gap-1">
                    {(["designed", "executed", "defects"] as const).map((f) => {
                      const m = FIELD_META[f];
                      const val = dayTotals[day.date]![f as keyof CellValue];
                      return (
                        <div
                          key={f}
                          className="flex items-center justify-between gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs backdrop-blur-sm"
                          title={m.label}
                        >
                          <span className="inline-flex items-center gap-1 opacity-80">
                            {m.icon}
                            <span className="text-[10px] font-semibold">{m.short}</span>
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
              <td
                className="sticky right-0 z-10 bg-[#1F3864] p-2 border-l-2 border-[#4A90D9]"
                style={{ minWidth: 110 }}
              >
                <div className="flex flex-col gap-1">
                  <div className="text-center text-[9px] uppercase tracking-wider text-white/70 font-bold pb-0.5 border-b border-white/20">
                    Semana
                  </div>
                  {(["designed", "executed", "defects"] as const).map((f) => {
                    const m = FIELD_META[f];
                    const val = Object.values(rowTotals).reduce((s, r) => s + r[f as keyof CellValue], 0);
                    return (
                      <div
                        key={f}
                        className="flex items-center justify-between gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-xs"
                        title={m.label}
                      >
                        <span className="inline-flex items-center gap-1 opacity-80">
                          {m.icon}
                          <span className="text-[10px] font-semibold">{m.short}</span>
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded bg-[#1F3864] px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar semana"}
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
