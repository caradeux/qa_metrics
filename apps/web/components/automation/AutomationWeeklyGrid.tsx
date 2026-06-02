"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  automationRecordsApi,
  type AutomationWeekResponse,
  type AutomationBulkEntry,
} from "@/lib/api-client";

type Field =
  | "scriptsCreated" | "scriptsRefactored" | "scriptsFixed"
  | "execTotal" | "execPassed" | "execFailed";

const NUM_FIELDS: Field[] = [
  "scriptsCreated", "scriptsRefactored", "scriptsFixed",
  "execTotal", "execPassed", "execFailed",
];

const SCRIPT_METRICS: { key: Field; label: string }[] = [
  { key: "scriptsCreated", label: "Creados" },
  { key: "scriptsRefactored", label: "Refactorizados" },
  { key: "scriptsFixed", label: "Corregidos" },
];
const EXEC_METRICS: { key: Field; label: string }[] = [
  { key: "execTotal", label: "Ejecuciones" },
  { key: "execPassed", label: "Pasaron" },
  { key: "execFailed", label: "Fallaron" },
];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200",
  PAUSED: "bg-gray-100 text-gray-500 border-gray-200",
  DONE: "bg-gray-100 text-gray-500 border-gray-200",
};

type CellValue = Record<Field, number> & { notes: string | null };
type DraftMap = Record<string, Record<string, CellValue>>; // assignmentId -> date -> cell

function emptyCell(): CellValue {
  return { scriptsCreated: 0, scriptsRefactored: 0, scriptsFixed: 0, execTotal: 0, execPassed: 0, execFailed: 0, notes: null };
}

function buildDraft(data: AutomationWeekResponse): DraftMap {
  const draft: DraftMap = {};
  for (const a of data.assignments) {
    draft[a.id] = {};
    for (const day of data.days) {
      const rec = a.records.find((r) => r.date === day.date);
      draft[a.id][day.date] = rec
        ? { scriptsCreated: rec.scriptsCreated, scriptsRefactored: rec.scriptsRefactored, scriptsFixed: rec.scriptsFixed, execTotal: rec.execTotal, execPassed: rec.execPassed, execFailed: rec.execFailed, notes: rec.notes }
        : emptyCell();
    }
  }
  return draft;
}

function cellEquals(a: CellValue, b: CellValue): boolean {
  return NUM_FIELDS.every((f) => a[f] === b[f]) && (a.notes ?? "") === (b.notes ?? "");
}
function cellIsEmpty(c: CellValue): boolean {
  return NUM_FIELDS.every((f) => c[f] === 0) && !c.notes;
}

export function AutomationWeeklyGrid({ testerId, weekStart }: { testerId: string; weekStart: Date }) {
  const [data, setData] = useState<AutomationWeekResponse | null>(null);
  const [draft, setDraft] = useState<DraftMap>({});
  const [initial, setInitial] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ assignmentId: string; date: string } | null>(null);

  const mondayStr = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await automationRecordsApi.week(testerId, mondayStr);
      setData(res);
      const d = buildDraft(res);
      setDraft(d);
      setInitial(JSON.parse(JSON.stringify(d)));
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar");
      setData(null);
    }
    setLoading(false);
  }, [testerId, mondayStr]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => {
    for (const aId of Object.keys(draft)) {
      for (const date of Object.keys(draft[aId] ?? {})) {
        if (!cellEquals(draft[aId][date], initial[aId]?.[date] ?? emptyCell())) return true;
      }
    }
    return false;
  }, [draft, initial]);

  const setCell = (assignmentId: string, date: string, field: Field, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [date]: { ...prev[assignmentId][date], [field]: Math.max(0, value || 0) } },
    }));
  };
  const setNote = (assignmentId: string, date: string, notes: string) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], [date]: { ...prev[assignmentId][date], notes: notes || null } },
    }));
  };

  const persist = async () => {
    if (!data) return;
    for (const a of data.assignments) {
      for (const day of data.days) {
        const c = draft[a.id]?.[day.date];
        if (c && c.execPassed + c.execFailed > c.execTotal) {
          setError(`En ${format(new Date(day.date + "T00:00:00"), "EEE d", { locale: es })}: pasaron + fallaron supera el total de ejecuciones.`);
          return;
        }
      }
    }
    const entries: AutomationBulkEntry[] = [];
    for (const a of data.assignments) {
      for (const day of data.days) {
        const cur = draft[a.id]?.[day.date];
        const init = initial[a.id]?.[day.date] ?? emptyCell();
        if (!cur || cellEquals(cur, init) || (cellIsEmpty(cur) && !init)) continue;
        entries.push({
          assignmentId: a.id, date: day.date,
          scriptsCreated: cur.scriptsCreated, scriptsRefactored: cur.scriptsRefactored, scriptsFixed: cur.scriptsFixed,
          execTotal: cur.execTotal, execPassed: cur.execPassed, execFailed: cur.execFailed, notes: cur.notes,
        });
      }
    }
    if (entries.length === 0) return;
    setSaving(true); setError(null);
    try {
      await automationRecordsApi.bulk(testerId, entries);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }
  if (error && !data) return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return null;
  if (data.assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center">
        <p className="text-sm font-medium text-gray-600">No tienes líneas de prueba activas esta semana.</p>
        <p className="mt-1 text-xs text-gray-400">Cuando te asignen una línea, aparecerá aquí para registrar tu avance.</p>
      </div>
    );
  }

  const weekday = (iso: string) => format(new Date(iso + "T00:00:00"), "EEE", { locale: es });
  const dayNum = (iso: string) => format(new Date(iso + "T00:00:00"), "d", { locale: es });

  const sumField = (aId: string, field: Field) =>
    data.days.reduce((s, day) => s + (draft[aId]?.[day.date]?.[field] ?? 0), 0);

  return (
    <div className="space-y-4 pb-24">
      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {data.assignments.map((a) => {
        const execTotal = sumField(a.id, "execTotal");
        const execPassed = sumField(a.id, "execPassed");
        const passRate = execTotal > 0 ? Math.round((execPassed / execTotal) * 100) : null;
        const created = sumField(a.id, "scriptsCreated");

        const renderMetricRow = (m: { key: Field; label: string }, accent: boolean) => (
          <tr key={m.key} className="group">
            <th scope="row" className="sticky left-0 z-[1] bg-white py-1.5 pl-4 pr-3 text-left text-xs font-normal text-gray-600 group-hover:bg-gray-50/60">
              {m.label}
            </th>
            {data.days.map((day) => {
              const active = a.activeOnDates.includes(day.date);
              const disabled = !active || day.isHoliday || day.isFuture;
              const v = draft[a.id]?.[day.date]?.[m.key] ?? 0;
              return (
                <td key={day.date} className={`px-1.5 py-1 text-center ${disabled ? "bg-gray-50/50" : ""}`}>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    disabled={disabled}
                    value={v === 0 ? "" : v}
                    placeholder={disabled ? "" : "0"}
                    onChange={(e) => setCell(a.id, day.date, m.key, parseInt(e.target.value, 10))}
                    className={`h-9 w-14 rounded-lg border text-center text-sm tabular-nums transition
                      ${accent ? "border-gray-200" : "border-gray-200"}
                      focus:border-[#2E5FA3] focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/25
                      disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-gray-300 disabled:placeholder-transparent`}
                  />
                </td>
              );
            })}
            <td className="py-1 pl-2 pr-4 text-right text-sm font-semibold tabular-nums text-gray-700">{sumField(a.id, m.key)}</td>
          </tr>
        );

        const groupHeader = (label: string) => (
          <tr>
            <td colSpan={data.days.length + 2} className="bg-gray-50/70 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </td>
          </tr>
        );

        return (
          <section key={a.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Cabecera de la línea */}
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F3864]/[0.06] text-[#1F3864]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">{a.testLine.name}</h3>
                  {a.testLine.externalId && <p className="text-[11px] text-gray-400 font-mono">{a.testLine.externalId}</p>}
                </div>
                <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status] ?? STATUS_STYLE.PAUSED}`}>{a.status}</span>
              </div>
              <div className="ml-auto flex items-center gap-5 text-xs">
                <div className="text-right">
                  <span className="block font-semibold text-gray-900 tabular-nums">{created}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">scripts creados</span>
                </div>
                <div className="text-right">
                  <span className="block font-semibold tabular-nums text-emerald-600">{passRate === null ? "—" : `${passRate}%`}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">pass-rate</span>
                </div>
              </div>
            </header>

            {/* Tabla de métricas */}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="sticky left-0 z-[1] bg-white py-2 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Métrica</th>
                    {data.days.map((day) => (
                      <th key={day.date} className={`px-1.5 py-2 text-center ${day.isHoliday ? "bg-amber-50/60" : ""}`}>
                        <span className={`block text-[11px] font-semibold capitalize ${day.isFuture ? "text-gray-300" : "text-gray-600"}`}>{weekday(day.date)}</span>
                        <span className={`block text-[10px] tabular-nums ${day.isHoliday ? "text-amber-600" : day.isFuture ? "text-gray-300" : "text-gray-400"}`}>{dayNum(day.date)}</span>
                      </th>
                    ))}
                    <th className="py-2 pl-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupHeader("Scripts")}
                  {SCRIPT_METRICS.map((m) => renderMetricRow(m, true))}
                  {groupHeader("Ejecuciones")}
                  {EXEC_METRICS.map((m) => renderMetricRow(m, false))}
                  {/* Notas por día */}
                  <tr className="border-t border-gray-100">
                    <th scope="row" className="sticky left-0 z-[1] bg-white py-1.5 pl-4 pr-3 text-left text-xs font-normal text-gray-400">Notas</th>
                    {data.days.map((day) => {
                      const active = a.activeOnDates.includes(day.date);
                      const disabled = !active || day.isHoliday || day.isFuture;
                      const hasNote = !!draft[a.id]?.[day.date]?.notes;
                      return (
                        <td key={day.date} className="px-1.5 py-1.5 text-center">
                          {!disabled && (
                            <button
                              onClick={() => setNoteFor({ assignmentId: a.id, date: day.date })}
                              title={hasNote ? "Editar nota" : "Agregar nota"}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition ${hasNote ? "bg-[#2E5FA3]/10 text-[#2E5FA3]" : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="pr-4" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* Barra de guardado fija (alineada al área de contenido, sin tapar el sidebar) */}
      <div className="fixed bottom-0 right-0 left-0 lg:left-64 z-30 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="flex items-center justify-end gap-3 px-6 py-3">
          {dirty && <span className="text-xs font-medium text-amber-600">Tienes cambios sin guardar</span>}
          <button
            onClick={persist}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F3864] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E5FA3] disabled:opacity-40"
          >
            {saving && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>}
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Modal de nota */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setNoteFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-[#1F3864]">Nota del día</h3>
            <p className="mb-3 text-xs text-gray-400">{format(new Date(noteFor.date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}</p>
            <textarea
              autoFocus
              maxLength={2000}
              value={draft[noteFor.assignmentId]?.[noteFor.date]?.notes ?? ""}
              onChange={(e) => setNote(noteFor.assignmentId, noteFor.date, e.target.value)}
              placeholder="Observaciones del día (opcional)…"
              className="h-32 w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-[#2E5FA3] focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]/25"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setNote(noteFor.assignmentId, noteFor.date, "")} className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700">Borrar</button>
              <button onClick={() => setNoteFor(null)} className="rounded-lg bg-[#1F3864] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2E5FA3]">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
