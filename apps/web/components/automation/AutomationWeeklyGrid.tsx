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

const FIELD_LABEL: Record<Field, string> = {
  scriptsCreated: "Creados",
  scriptsRefactored: "Refactor",
  scriptsFixed: "Corregidos",
  execTotal: "Ejec.",
  execPassed: "Pasaron",
  execFailed: "Fallaron",
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
        const cur = draft[aId][date];
        const init = initial[aId]?.[date] ?? emptyCell();
        if (!cellEquals(cur, init)) return true;
      }
    }
    return false;
  }, [draft, initial]);

  const setCell = (assignmentId: string, date: string, field: Field, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [date]: { ...prev[assignmentId][date], [field]: Math.max(0, value || 0) },
      },
    }));
  };

  const setNote = (assignmentId: string, date: string, notes: string) => {
    setDraft((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [date]: { ...prev[assignmentId][date], notes: notes || null },
      },
    }));
  };

  const persist = async () => {
    if (!data) return;
    // Client-side guard mirroring the backend rule.
    for (const a of data.assignments) {
      for (const day of data.days) {
        const c = draft[a.id]?.[day.date];
        if (c && c.execPassed + c.execFailed > c.execTotal) {
          setError(`En ${day.date}: pasaron+fallaron excede el total de ejecuciones.`);
          return;
        }
      }
    }
    const entries: AutomationBulkEntry[] = [];
    for (const a of data.assignments) {
      for (const day of data.days) {
        const cur = draft[a.id]?.[day.date];
        const init = initial[a.id]?.[day.date] ?? emptyCell();
        if (!cur) continue;
        if (cellEquals(cur, init)) continue;        // unchanged
        if (cellIsEmpty(cur) && !init) continue;     // never had data, still empty
        entries.push({
          assignmentId: a.id,
          date: day.date,
          scriptsCreated: cur.scriptsCreated,
          scriptsRefactored: cur.scriptsRefactored,
          scriptsFixed: cur.scriptsFixed,
          execTotal: cur.execTotal,
          execPassed: cur.execPassed,
          execFailed: cur.execFailed,
          notes: cur.notes,
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

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando semana…</div>;
  if (error && !data) return <div className="p-6 text-sm text-danger">Error: {error}</div>;
  if (!data) return null;
  if (data.assignments.length === 0) {
    return <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center text-sm text-gray-500">No tienes líneas de prueba activas esta semana.</div>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Línea de prueba</th>
              {data.days.map((d) => (
                <th key={d.date} className={`px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider ${d.isHoliday ? "text-amber-600 bg-amber-50" : "text-gray-400"}`}>
                  {format(new Date(d.date + "T00:00:00"), "EEE dd", { locale: es })}
                  {d.isHoliday && <div className="text-[9px] normal-case">{d.holidayName}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.assignments.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 align-top">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 min-w-[180px]">
                  {a.testLine.name}
                  <div className="text-[10px] text-gray-400">{a.status}</div>
                </td>
                {data.days.map((d) => {
                  const active = a.activeOnDates.includes(d.date);
                  const disabled = !active || d.isHoliday || d.isFuture;
                  const cell = draft[a.id]?.[d.date] ?? emptyCell();
                  return (
                    <td key={d.date} className={`px-2 py-1.5 ${disabled ? "bg-gray-50/60" : ""}`}>
                      <div className="grid grid-cols-3 gap-1">
                        {NUM_FIELDS.map((f) => (
                          <label key={f} className="flex flex-col items-center">
                            <span className="text-[8px] text-gray-400 uppercase">{FIELD_LABEL[f]}</span>
                            <input
                              type="number"
                              min={0}
                              disabled={disabled}
                              value={cell[f] === 0 ? "" : cell[f]}
                              onChange={(e) => setCell(a.id, d.date, f, parseInt(e.target.value, 10))}
                              className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-[#1F3864] focus:outline-none disabled:bg-transparent disabled:text-gray-300"
                            />
                          </label>
                        ))}
                      </div>
                      {!disabled && (
                        <button onClick={() => setNoteFor({ assignmentId: a.id, date: d.date })} className="mt-1 text-[9px] text-[#2E5FA3] hover:underline">
                          {cell.notes ? "✎ nota" : "+ nota"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={persist}
          disabled={!dirty || saving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {dirty && <span className="text-xs text-amber-600">Hay cambios sin guardar</span>}
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNoteFor(null)}>
          <div className="w-[28rem] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-sm font-bold text-[#1F3864]">Nota del día</h3>
            <textarea
              autoFocus
              maxLength={2000}
              value={draft[noteFor.assignmentId]?.[noteFor.date]?.notes ?? ""}
              onChange={(e) => setNote(noteFor.assignmentId, noteFor.date, e.target.value)}
              className="h-32 w-full rounded-lg border border-border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <div className="mt-3 flex justify-end">
              <button onClick={() => setNoteFor(null)} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
