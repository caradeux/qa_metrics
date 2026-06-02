"use client";

import { useEffect, useMemo, useState } from "react";
import { startOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  automationRecordsApi,
  type AutomationWeekResponse,
  type AutomationBulkEntry,
} from "@/lib/api-client";

type Field =
  | "scriptsCreated" | "scriptsRefactored" | "scriptsFixed"
  | "execTotal" | "execPassed" | "execFailed";

const FIELDS: Field[] = [
  "scriptsCreated", "scriptsRefactored", "scriptsFixed",
  "execTotal", "execPassed", "execFailed",
];

const FIELD_META: Record<Field, { short: string; label: string; description: string; color: string; icon: React.ReactNode }> = {
  scriptsCreated: {
    short: "Cr", label: "Creados", description: "Scripts creados", color: "#2E5FA3",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>),
  },
  scriptsRefactored: {
    short: "Rf", label: "Refactor", description: "Scripts refactorizados", color: "#0891b2",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>),
  },
  scriptsFixed: {
    short: "Cg", label: "Corregidos", description: "Scripts corregidos", color: "#d97706",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" /></svg>),
  },
  execTotal: {
    short: "Ej", label: "Ejecuciones", description: "Ejecuciones totales", color: "#6366f1",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
  },
  execPassed: {
    short: "OK", label: "Pasaron", description: "Ejecuciones exitosas", color: "#059669",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
  },
  execFailed: {
    short: "KO", label: "Fallaron", description: "Ejecuciones fallidas", color: "#dc2626",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
  },
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200",
  PAUSED: "bg-gray-100 text-gray-500 border-gray-200",
  DONE: "bg-gray-100 text-gray-500 border-gray-200",
};

type CellValue = Record<Field, number> & { notes: string };
const EMPTY_CELL: CellValue = { scriptsCreated: 0, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0, notes: "" };
type DraftMap = Record<string, Record<string, CellValue>>;

function buildDraft(data: AutomationWeekResponse): DraftMap {
  const out: DraftMap = {};
  for (const a of data.assignments) {
    out[a.id] = {};
    for (const r of a.records) {
      out[a.id]![r.date] = {
        scriptsCreated: r.scriptsCreated, scriptsRefactored: r.scriptsRefactored, scriptsFixed: r.scriptsFixed,
        execTotal: r.execTotal, execPassed: r.execPassed, execFailed: r.execFailed, notes: r.notes ?? "",
      };
    }
  }
  return out;
}
function cellEquals(a: CellValue, b: CellValue) {
  return FIELDS.every((f) => a[f] === b[f]) && (a.notes ?? "") === (b.notes ?? "");
}

export function AutomationWeeklyGrid({ testerId, weekStart }: { testerId: string; weekStart: Date }) {
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const mondayStr = format(monday, "yyyy-MM-dd");

  const [data, setData] = useState<AutomationWeekResponse | null>(null);
  const [initial, setInitial] = useState<DraftMap>({});
  const [draft, setDraft] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [openNoteFor, setOpenNoteFor] = useState<{ assignmentId: string; date: string } | null>(null);

  const load = () => {
    setError(null);
    automationRecordsApi.week(testerId, mondayStr)
      .then((r) => {
        setData(r);
        const d = buildDraft(r);
        setInitial(d);
        setDraft(JSON.parse(JSON.stringify(d)));
      })
      .catch((e: any) => setError(e?.message ?? "Error al cargar"));
  };
  useEffect(load, [testerId, mondayStr]);

  const dirty = useMemo(() => {
    for (const aid of Object.keys(draft)) {
      const cur = draft[aid] ?? {}; const init = initial[aid] ?? {};
      const keys = new Set([...Object.keys(cur), ...Object.keys(init)]);
      for (const k of keys) { if (!cellEquals(cur[k] ?? EMPTY_CELL, init[k] ?? EMPTY_CELL)) return true; }
    }
    return false;
  }, [draft, initial]);

  const getCell = (aId: string, date: string): CellValue => draft[aId]?.[date] ?? EMPTY_CELL;

  const setCell = (aId: string, date: string, field: Field, value: number) => {
    setDraft((prev) => {
      const next = { ...prev };
      const row = { ...(next[aId] ?? {}) };
      row[date] = { ...(row[date] ?? EMPTY_CELL), [field]: Math.max(0, value | 0) };
      next[aId] = row;
      return next;
    });
  };
  const setCellNotes = (aId: string, date: string, value: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      const row = { ...(next[aId] ?? {}) };
      row[date] = { ...(row[date] ?? EMPTY_CELL), notes: value.slice(0, 2000) };
      next[aId] = row;
      return next;
    });
  };

  const persist = async () => {
    if (!data) return;
    // Validación: pasaron + fallaron no puede superar el total de ejecuciones.
    for (const a of data.assignments) {
      for (const day of data.days) {
        if (day.isHoliday || day.isFuture || !a.activeOnDates.includes(day.date)) continue;
        const c = getCell(a.id, day.date);
        if (c.execPassed + c.execFailed > c.execTotal) {
          setError(`${a.testLine.name} · ${day.date}: pasaron + fallaron supera el total de ejecuciones.`);
          return;
        }
      }
    }
    setSaving(true); setError(null);
    try {
      const entries: AutomationBulkEntry[] = [];
      for (const a of data.assignments) {
        for (const day of data.days) {
          if (day.isHoliday || day.isFuture || !a.activeOnDates.includes(day.date)) continue;
          const cur = getCell(a.id, day.date);
          const init = initial[a.id]?.[day.date] ?? EMPTY_CELL;
          if (!cellEquals(cur, init)) {
            entries.push({
              assignmentId: a.id, date: day.date,
              scriptsCreated: cur.scriptsCreated, scriptsRefactored: cur.scriptsRefactored, scriptsFixed: cur.scriptsFixed,
              execTotal: cur.execTotal, execPassed: cur.execPassed, execFailed: cur.execFailed,
              notes: cur.notes.trim() === "" ? null : cur.notes,
            });
          }
        }
      }
      if (entries.length === 0) { setSaving(false); return; }
      await automationRecordsApi.bulk(testerId, entries);
      setLastSaved(new Date());
      load();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return <div className="rounded-lg border bg-white p-4 shadow-sm text-sm text-gray-500">{error ?? "Cargando..."}</div>;
  }
  if (data.assignments.length === 0) {
    return <div className="rounded-lg border bg-white p-6 shadow-sm text-sm text-gray-600">No tienes líneas de prueba activas esta semana.</div>;
  }

  const dayTotals: Record<string, CellValue> = {};
  for (const d of data.days) dayTotals[d.date] = { ...EMPTY_CELL };
  const rowTotals: Record<string, CellValue> = {};
  for (const a of data.assignments) {
    rowTotals[a.id] = { ...EMPTY_CELL };
    for (const day of data.days) {
      if (!a.activeOnDates.includes(day.date)) continue;
      const c = getCell(a.id, day.date);
      for (const f of FIELDS) { rowTotals[a.id]![f] += c[f]; dayTotals[day.date]![f] += c[f]; }
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      {/* Leyenda */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-500">Leyenda</span>
        {FIELDS.map((f, i) => {
          const m = FIELD_META[f];
          return (
            <span key={f} className="inline-flex items-center gap-1.5">
              {i === 3 && <span className="mx-1 h-3 w-px bg-gray-300" />}
              <span className="inline-flex h-5 w-5 items-center justify-center rounded" style={{ color: m.color, backgroundColor: `${m.color}15` }}>{m.icon}</span>
              <span className="font-semibold" style={{ color: m.color }}>{m.short}</span>
              <span>= {m.label}</span>
            </span>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1F3864] text-white">
              <th className="sticky left-0 z-10 bg-[#1F3864] p-2 text-left" style={{ minWidth: 240, width: 240 }}>Línea de prueba</th>
              {data.days.map((d) => (
                <th key={d.date} className={`p-2 text-center ${d.isHoliday ? "bg-yellow-400 text-yellow-900" : ""}`} style={{ minWidth: 130 }}>
                  <div className="capitalize">{format(new Date(d.date + "T12:00:00"), "EEE dd MMM", { locale: es })}</div>
                  {d.isHoliday && <div className="mt-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-normal text-yellow-900">{d.holidayName}</div>}
                </th>
              ))}
              <th className="sticky right-0 z-10 bg-[#1F3864] p-2 text-center" style={{ minWidth: 100 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.assignments.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="sticky left-0 z-10 bg-white p-2 align-top" style={{ minWidth: 240, width: 240 }}>
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold text-[#1F3864]">
                      {a.testLine.externalId ? <span className="mr-1 text-xs text-gray-500">#{a.testLine.externalId}</span> : null}
                      {a.testLine.name}
                    </div>
                    <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status] ?? STATUS_STYLE.PAUSED}`}>{a.status}</span>
                  </div>
                </td>
                {data.days.map((day) => {
                  const active = a.activeOnDates.includes(day.date);
                  const disabled = !active || day.isHoliday || day.isFuture;
                  const cell = getCell(a.id, day.date);
                  return (
                    <td key={day.date} className={`p-1 align-top ${disabled ? "bg-gray-100" : "bg-white"}`}>
                      <div className="flex flex-col gap-1">
                        {FIELDS.map((field, i) => {
                          const m = FIELD_META[field];
                          return (
                            <div key={field}>
                              {i === 3 && <div className="my-1 h-px bg-gray-100" />}
                              <label className="flex items-center gap-1 text-xs text-gray-600" title={`${m.label} — ${m.description}`}>
                                <span className="inline-flex w-8 items-center gap-0.5" style={{ color: m.color }}>
                                  {m.icon}<span className="font-semibold">{m.short}</span>
                                </span>
                                <input
                                  type="number" min={0} inputMode="numeric" disabled={disabled}
                                  value={cell[field] === 0 ? "" : cell[field]}
                                  placeholder={disabled ? "" : "0"}
                                  onChange={(e) => setCell(a.id, day.date, field, Number(e.target.value))}
                                  className="w-14 rounded border border-gray-300 px-1 py-0.5 text-center text-xs tabular-nums focus:border-[#2E5FA3] focus:outline-none focus:ring-1 focus:ring-[#2E5FA3]/30 disabled:bg-gray-200 disabled:text-gray-400 disabled:placeholder-transparent"
                                />
                              </label>
                            </div>
                          );
                        })}
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => setOpenNoteFor({ assignmentId: a.id, date: day.date })}
                            title={cell.notes ? `Nota: ${cell.notes.slice(0, 80)}${cell.notes.length > 80 ? "…" : ""}` : "Agregar nota"}
                            className={`mt-0.5 inline-flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[10px] transition ${cell.notes ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            {cell.notes ? "Nota" : "+nota"}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 bg-gradient-to-l from-slate-100 to-slate-50 p-2 align-top border-l-2 border-slate-200" style={{ minWidth: 100 }}>
                  <div className="flex flex-col gap-1">
                    {FIELDS.map((f, i) => {
                      const m = FIELD_META[f];
                      const val = rowTotals[a.id]![f];
                      const isZero = val === 0;
                      return (
                        <div key={f}>
                          {i === 3 && <div className="my-1 h-px bg-slate-200" />}
                          <div className={`flex items-center justify-between gap-1.5 rounded-md px-2 py-0.5 text-xs ${isZero ? "bg-white/60 text-gray-400" : "bg-white shadow-sm"}`} style={isZero ? {} : { color: m.color, border: `1px solid ${m.color}33` }} title={m.label}>
                            <span className="inline-flex items-center gap-1">{m.icon}<span className="text-[10px] font-semibold">{m.short}</span></span>
                            <span className="font-mono text-sm font-bold tabular-nums">{val}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] text-white">
              <td className="sticky left-0 z-10 bg-[#1F3864] p-3 font-bold uppercase tracking-wider text-[11px]" style={{ minWidth: 240, width: 240 }}>Total del día</td>
              {data.days.map((day) => (
                <td key={day.date} className="p-2 text-center">
                  <div className="flex flex-col items-stretch gap-1">
                    {FIELDS.map((f, i) => {
                      const m = FIELD_META[f];
                      return (
                        <div key={f}>
                          {i === 3 && <div className="my-1 h-px bg-white/20" />}
                          <div className="flex items-center justify-between gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs" title={m.label}>
                            <span className="inline-flex items-center gap-1 opacity-80">{m.icon}<span className="text-[10px] font-semibold">{m.short}</span></span>
                            <span className="font-mono text-sm font-bold tabular-nums">{dayTotals[day.date]![f]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
              <td className="sticky right-0 z-10 bg-[#1F3864] p-2 border-l-2 border-[#4A90D9]" style={{ minWidth: 100 }}>
                <div className="flex flex-col gap-1">
                  <div className="text-center text-[9px] uppercase tracking-wider text-white/70 font-bold pb-0.5 border-b border-white/20">Semana</div>
                  {FIELDS.map((f, i) => {
                    const m = FIELD_META[f];
                    const val = Object.values(rowTotals).reduce((s, r) => s + r[f], 0);
                    return (
                      <div key={f}>
                        {i === 3 && <div className="my-1 h-px bg-white/20" />}
                        <div className="flex items-center justify-between gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-xs" title={m.label}>
                          <span className="inline-flex items-center gap-1 opacity-80">{m.icon}<span className="text-[10px] font-semibold">{m.short}</span></span>
                          <span className="font-mono text-sm font-bold tabular-nums">{val}</span>
                        </div>
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
        <button onClick={persist} disabled={!dirty || saving} className="rounded bg-[#1F3864] px-4 py-2 text-white disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar semana"}
        </button>
        {lastSaved && <span className="text-xs text-gray-500">Guardado {lastSaved.toLocaleTimeString("es-CL")}</span>}
      </div>

      {openNoteFor && (() => {
        const a = data.assignments.find((x) => x.id === openNoteFor.assignmentId);
        if (!a) return null;
        const currentNote = draft[openNoteFor.assignmentId]?.[openNoteFor.date]?.notes ?? "";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Nota del día</h3>
                <p className="mt-0.5 text-xs text-gray-500">{a.testLine.name} · {openNoteFor.date}</p>
              </div>
              <div className="px-5 py-4">
                <textarea
                  autoFocus value={currentNote} rows={6} maxLength={2000}
                  onChange={(e) => setCellNotes(openNoteFor.assignmentId, openNoteFor.date, e.target.value)}
                  placeholder="Observaciones del día (opcional)…"
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20"
                />
                <p className="mt-1 text-right text-[10px] text-gray-400">{currentNote.length} / 2000</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
                <button onClick={() => setOpenNoteFor(null)} className="rounded border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
                <button onClick={() => { setCellNotes(openNoteFor.assignmentId, openNoteFor.date, ""); setOpenNoteFor(null); }} className="rounded border border-red-200 bg-white px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Borrar nota</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
