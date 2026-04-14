"use client";

import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isWeekend,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";

export interface GanttAssignment {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  tester: { id: string; name: string; project: { id: string; name: string; client: { name: string } } };
  cycle: { id: string; name: string } | null;
  story: { id: string; title: string; externalId?: string | null; designComplexity: string; executionComplexity: string };
  phases?: { id?: string; phase: string; startDate: string; endDate: string }[];
}

const PHASE_COLORS: Record<string, string> = {
  ANALYSIS: "#8b5cf6",
  TEST_DESIGN: "#2E5FA3",
  EXECUTION: "#0891b2",
};
const PHASE_LABELS: Record<string, string> = {
  ANALYSIS: "Análisis",
  TEST_DESIGN: "Diseño de casos",
  EXECUTION: "Ejecución",
};
const PHASE_SHORT: Record<string, string> = {
  ANALYSIS: "AN",
  TEST_DESIGN: "DIS",
  EXECUTION: "EJE",
};

export interface GanttStatus {
  value: string;
  label: string;
  short: string;
  color: string;
}

export interface GanttChartProps {
  assignments: GanttAssignment[];
  dateFrom: Date;
  dateTo: Date;
  statuses: readonly GanttStatus[];
  holidays: Record<string, string>;
  onBarClick?: (a: GanttAssignment) => void;
  colWidth?: number;
}

const ROW_HEIGHT = 40;
const LEFT_COL_WIDTH = 220;
const BAR_HEIGHT = 28;

function fmtDate(d: string | Date) {
  return format(typeof d === "string" ? parseDateOnly(d) : d, "dd MMM yyyy", { locale: es });
}

/**
 * Convierte un string "YYYY-MM-DD..." o Date en un Date local a la medianoche
 * del mismo día calendario, evitando el corrimiento por zona horaria.
 */
function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const ymd = value.slice(0, 10); // "2026-04-13"
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function GanttChart({
  assignments,
  dateFrom,
  dateTo,
  statuses,
  holidays,
  onBarClick,
  colWidth = 32,
}: GanttChartProps) {
  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.value, s])),
    [statuses]
  );

  const days = useMemo(() => {
    const from = startOfDay(dateFrom);
    const n = differenceInCalendarDays(startOfDay(dateTo), from) + 1;
    return Array.from({ length: Math.max(n, 1) }, (_, i) => addDays(from, i));
  }, [dateFrom, dateTo]);

  const today = startOfDay(new Date());
  const totalWidth = days.length * colWidth;

  // Group months for header
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number; ref: Date }[] = [];
    for (const d of days) {
      const last = groups[groups.length - 1];
      if (last && isSameMonth(last.ref, d)) {
        last.span += 1;
      } else {
        groups.push({ label: format(d, "MMMM yyyy", { locale: es }), span: 1, ref: d });
      }
    }
    return groups;
  }, [days]);

  // Group by tester
  const rows = useMemo(() => {
    const map = new Map<string, { tester: GanttAssignment["tester"]; items: GanttAssignment[] }>();
    for (const a of assignments) {
      if (!map.has(a.tester.id)) map.set(a.tester.id, { tester: a.tester, items: [] });
      map.get(a.tester.id)!.items.push(a);
    }
    // Extrae número de ciclo de su nombre ("Ciclo 1" -> 1). Fallback: Infinity para ciclos sin número.
    const cycleNum = (c?: { name: string } | null) => {
      if (!c?.name) return Infinity;
      const m = c.name.match(/(\d+)/);
      return m ? Number(m[1]) : Infinity;
    };
    // Ordenar items: por título de HU, luego ciclo 1, ciclo 2..., luego startDate.
    for (const row of map.values()) {
      row.items.sort((a, b) => {
        const titleCmp = a.story.title.localeCompare(b.story.title);
        if (titleCmp !== 0) return titleCmp;
        const cycleCmp = cycleNum(a.cycle) - cycleNum(b.cycle);
        if (cycleCmp !== 0) return cycleCmp;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
    }
    return Array.from(map.values()).sort((a, b) => a.tester.name.localeCompare(b.tester.name));
  }, [assignments]);

  const todayLeft = (() => {
    const diff = differenceInCalendarDays(today, startOfDay(dateFrom));
    if (diff < 0 || diff > days.length - 1) return null;
    return diff * colWidth + colWidth / 2;
  })();

  if (rows.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
        <p className="text-sm font-medium text-gray-500">Sin asignaciones en el rango seleccionado</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div style={{ width: LEFT_COL_WIDTH + totalWidth, position: "relative" }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 bg-white border-b border-gray-200 flex"
            style={{ minWidth: LEFT_COL_WIDTH + totalWidth }}
          >
            <div
              className="sticky left-0 z-30 bg-white border-r border-gray-200 flex items-end px-3 py-2"
              style={{ width: LEFT_COL_WIDTH, minWidth: LEFT_COL_WIDTH }}
            >
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Tester / Proyecto
              </span>
            </div>
            <div style={{ width: totalWidth }}>
              {/* Month row */}
              <div className="flex border-b border-gray-100 bg-gray-50">
                {monthGroups.map((g, i) => (
                  <div
                    key={i}
                    className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-2 py-1 border-r border-gray-200 truncate"
                    style={{ width: g.span * colWidth, minWidth: g.span * colWidth }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Days row */}
              <div className="flex">
                {days.map((d, i) => {
                  const iso = format(d, "yyyy-MM-dd");
                  const holiday = holidays[iso];
                  const weekend = isWeekend(d);
                  const isToday = differenceInCalendarDays(d, today) === 0;
                  return (
                    <div
                      key={i}
                      title={holiday || ""}
                      className={`flex flex-col items-center justify-center py-1 border-r text-[9px] ${
                        isToday
                          ? "bg-red-50 border-red-200 text-red-700 font-bold"
                          : holiday
                            ? "bg-yellow-50 border-yellow-100 text-yellow-800"
                            : weekend
                              ? "bg-gray-100 border-gray-200 text-gray-400"
                              : "bg-white border-gray-100 text-gray-500"
                      }`}
                      style={{ width: colWidth, minWidth: colWidth }}
                    >
                      <span className="font-mono font-semibold leading-none">{format(d, "d")}</span>
                      <span className="uppercase leading-none mt-0.5 opacity-70">
                        {format(d, "EEE", { locale: es }).slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div style={{ position: "relative" }}>
            {/* Today vertical line (overlay) */}
            {todayLeft !== null && (
              <div
                className="absolute pointer-events-none z-10"
                style={{
                  left: LEFT_COL_WIDTH + todayLeft,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#ef4444",
                }}
              >
                <span
                  className="absolute -top-0 left-1 px-1 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-sm uppercase"
                  style={{ transform: "translateY(-100%)" }}
                >
                  Hoy
                </span>
              </div>
            )}

            {rows.flatMap((row) => {
              // Rango resumen del tester: min startDate → max endDate (o hoy si hay en curso)
              const allStarts = row.items.map((i) => parseDateOnly(i.startDate).getTime());
              const allEnds = row.items.map((i) =>
                i.endDate ? parseDateOnly(i.endDate).getTime() : today.getTime()
              );
              const summaryStart = new Date(Math.min(...allStarts));
              const summaryEnd = new Date(Math.max(...allEnds));

              const parentRow = (
                <div
                  key={`parent-${row.tester.id}`}
                  className="flex border-b-2 border-[#1F3864]/15 bg-gradient-to-r from-[#1F3864]/5 to-transparent"
                  style={{ minHeight: ROW_HEIGHT }}
                >
                  <div
                    className="sticky left-0 z-10 bg-gradient-to-r from-[#1F3864]/10 to-[#1F3864]/5 border-r border-gray-200 px-3 py-2 flex flex-col justify-center"
                    style={{ width: LEFT_COL_WIDTH, minWidth: LEFT_COL_WIDTH }}
                  >
                    <p className="text-xs font-bold text-[#1F3864] truncate leading-tight">
                      {row.tester.name}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate leading-tight">
                      {row.tester.project.client.name} · {row.tester.project.name}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      {row.items.length} HU{row.items.length > 1 ? "s" : ""} asignada{row.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="relative" style={{ width: totalWidth, minHeight: ROW_HEIGHT }}>
                    {/* Day column background */}
                    <div className="absolute inset-0 flex">
                      {days.map((d, i) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const holiday = holidays[iso];
                        const weekend = isWeekend(d);
                        return (
                          <div
                            key={i}
                            className={`border-r ${
                              holiday
                                ? "bg-yellow-50/40 border-yellow-100/40"
                                : weekend
                                  ? "bg-gray-100/40 border-gray-200/40"
                                  : "border-gray-100/40"
                            }`}
                            style={{ width: colWidth, minWidth: colWidth }}
                          />
                        );
                      })}
                    </div>
                    {/* Summary bar (todo el rango del tester) */}
                    {(() => {
                      if (summaryEnd < dateFrom || summaryStart > dateTo) return null;
                      const clampedStart = summaryStart < dateFrom ? dateFrom : summaryStart;
                      const clampedEnd = summaryEnd > dateTo ? dateTo : summaryEnd;
                      const startOffset = differenceInCalendarDays(clampedStart, dateFrom);
                      const span = Math.max(1, differenceInCalendarDays(clampedEnd, clampedStart) + 1);
                      const left = startOffset * colWidth;
                      const width = span * colWidth - 2;
                      return (
                        <div
                          className="absolute rounded-full z-[1]"
                          style={{
                            left,
                            width: Math.max(width, 20),
                            top: ROW_HEIGHT / 2 - 3,
                            height: 6,
                            background: "linear-gradient(90deg, #1F3864 0%, #2E5FA3 100%)",
                            opacity: 0.5,
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              );

              const childRows = row.items.map((a) => (
              <div
                key={a.id}
                className="flex border-b border-gray-100 hover:bg-gray-50/60"
                style={{ minHeight: ROW_HEIGHT }}
              >
                {/* Left column */}
                <div
                  className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 flex flex-col justify-center"
                  style={{ width: LEFT_COL_WIDTH, minWidth: LEFT_COL_WIDTH }}
                >
                  <div className="flex items-center gap-1.5 pl-3">
                    <span className="text-gray-300 text-xs">↳</span>
                    <p
                      className="text-[11px] font-medium text-gray-700 truncate leading-tight"
                      title={a.story.title}
                    >
                      {a.story.title}
                    </p>
                  </div>
                  <p className="text-[9px] text-gray-400 truncate leading-tight pl-6">
                    {a.cycle?.name ?? ""}
                    {a.story.externalId ? ` · #${a.story.externalId}` : ""}
                  </p>
                </div>

                {/* Timeline area */}
                <div
                  className="relative"
                  style={{ width: totalWidth, minHeight: ROW_HEIGHT }}
                >
                  {/* Day column background */}
                  <div className="absolute inset-0 flex">
                    {days.map((d, i) => {
                      const iso = format(d, "yyyy-MM-dd");
                      const holiday = holidays[iso];
                      const weekend = isWeekend(d);
                      return (
                        <div
                          key={i}
                          className={`border-r ${
                            holiday
                              ? "bg-yellow-50/60 border-yellow-100"
                              : weekend
                                ? "bg-gray-100/70 border-gray-200"
                                : "border-gray-100"
                          }`}
                          style={{ width: colWidth, minWidth: colWidth }}
                          title={holiday || ""}
                        />
                      );
                    })}
                  </div>

                  {/* Bar(s) */}
                  {a.phases && a.phases.length > 0 ? (
                    <>
                      {a.phases.map((ph) => {
                        const pStart = parseDateOnly(ph.startDate);
                        const pEnd = parseDateOnly(ph.endDate);
                        if (pEnd < dateFrom || pStart > dateTo) return null;
                        const cs = pStart < dateFrom ? dateFrom : pStart;
                        const ce = pEnd > dateTo ? dateTo : pEnd;
                        const startOffset = differenceInCalendarDays(cs, dateFrom);
                        const span = Math.max(1, differenceInCalendarDays(ce, cs) + 1);
                        const left = startOffset * colWidth;
                        const width = span * colWidth - 2;
                        const color = PHASE_COLORS[ph.phase] || "#9ca3af";
                        return (
                          <button
                            key={`${a.id}-${ph.phase}`}
                            onClick={() => onBarClick?.(a)}
                            className="absolute rounded-md text-left px-1.5 flex items-center overflow-hidden text-white text-[10px] font-semibold shadow-sm hover:shadow-md hover:brightness-110 transition-all z-[2] border border-white/30"
                            style={{
                              left,
                              width: Math.max(width, 18),
                              top: 6,
                              height: BAR_HEIGHT,
                              background: color,
                            }}
                            title={[
                              `HU: ${a.story.title}`,
                              `Fase: ${PHASE_LABELS[ph.phase] || ph.phase}`,
                              `Del ${fmtDate(ph.startDate)} al ${fmtDate(ph.endDate)}`,
                            ].join("\n")}
                          >
                            <span className="truncate drop-shadow-sm">{PHASE_SHORT[ph.phase] || ph.phase}</span>
                          </button>
                        );
                      })}
                    </>
                  ) : (() => {
                    const s = statusMap[a.status] || { label: a.status, color: "#9ca3af", short: a.status };
                    const start = parseDateOnly(a.startDate);
                    const endRaw = a.endDate ? parseDateOnly(a.endDate) : null;
                    const end = endRaw ?? today;
                    const clampedStart = start < dateFrom ? dateFrom : start;
                    const clampedEnd = end > dateTo ? dateTo : end;
                    const startOffset = differenceInCalendarDays(clampedStart, dateFrom);
                    const span = Math.max(1, differenceInCalendarDays(clampedEnd, clampedStart) + 1);
                    const left = startOffset * colWidth;
                    const width = span * colWidth - 2;
                    const openEnded = !endRaw;

                    const top = 6;

                    return (
                      <button
                        key={a.id}
                        onClick={() => onBarClick?.(a)}
                        className="absolute rounded-md text-left px-2 flex items-center overflow-hidden text-white text-[10px] font-semibold shadow-sm hover:shadow-md hover:brightness-110 transition-all z-[2] border border-white/30"
                        style={{
                          left,
                          width: Math.max(width, 20),
                          top,
                          height: BAR_HEIGHT,
                          background: openEnded
                            ? `repeating-linear-gradient(45deg, ${s.color}, ${s.color} 6px, ${s.color}dd 6px, ${s.color}dd 12px)`
                            : s.color,
                        }}
                        title={[
                          `HU: ${a.story.title}`,
                          `Complejidad Ejec.: ${a.story.executionComplexity}`,
                          `Estado: ${s.label}`,
                          `Inicio: ${fmtDate(a.startDate)}`,
                          a.endDate ? `Fin: ${fmtDate(a.endDate)}` : "Fin: En curso",
                          a.notes ? `Notas: ${a.notes}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      >
                        <span className="truncate drop-shadow-sm">
                          {a.story.title}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
              ));
              return [parentRow, ...childRows];
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
