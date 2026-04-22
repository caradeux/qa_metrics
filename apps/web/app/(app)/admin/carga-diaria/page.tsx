"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

interface DailyLoadRow {
  userId: string;
  userName: string;
  userEmail: string;
  daily: {
    loaded: boolean;
    storiesCount: number;
    designed: number;
    executed: number;
    defects: number;
    lastAt: string | null;
  };
  activities: {
    loaded: boolean;
    hours: number;
    lastAt: string | null;
  };
}

interface DailyLoadResponse {
  date: string;
  isNonBusinessDay: boolean;
  rows: DailyLoadRow[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const iconCheck = (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const iconDash = (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
  </svg>
);

const iconClipboard = (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const iconBolt = (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const iconAlert = (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const iconChevronLeft = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const iconChevronRight = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const iconCalendar = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const iconCopy = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const iconMail = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

type RowStatus = "complete" | "partial" | "none";
function rowStatus(r: DailyLoadRow): RowStatus {
  const d = r.daily.loaded;
  const a = r.activities.loaded;
  if (d && a) return "complete";
  if (d || a) return "partial";
  return "none";
}

function missingLabel(r: DailyLoadRow): string {
  const missing: string[] = [];
  if (!r.daily.loaded) missing.push("el registro diario (HU diseñadas/ejecutadas/defectos)");
  if (!r.activities.loaded) missing.push("las actividades del día");
  if (missing.length === 0) return "";
  return missing.join(" y ");
}

function buildReminderMessage(row: DailyLoadRow, dateIso: string): string {
  const pretty = formatLongDate(dateIso);
  const firstName = row.userName.split(/\s+/)[0] ?? row.userName;
  const missing = missingLabel(row);
  if (!missing) {
    return `Hola ${firstName}, gracias por tener tu carga del ${pretty} al día.`;
  }
  return (
    `Hola ${firstName},\n\n` +
    `Notamos que no registraste ${missing} correspondiente al ${pretty}.\n\n` +
    `¿Puedes ponerte al día en QA Metrics lo antes posible? Si tuviste algún inconveniente, por favor avísame.\n\n` +
    `Gracias,\nEquipo QA`
  );
}

function buildAllPendingMessage(rows: DailyLoadRow[], dateIso: string): string {
  const pretty = formatLongDate(dateIso);
  const pending = rows.filter((r) => rowStatus(r) !== "complete");
  if (pending.length === 0) return `Todo el equipo cargó su día del ${pretty}. ¡Sin pendientes!`;
  const lines = pending.map((r) => `  • ${r.userName} (${r.userEmail}) — falta ${missingLabel(r)}`);
  return (
    `Pendientes de carga del ${pretty}:\n\n` +
    lines.join("\n") +
    `\n\nPor favor, pónganse al día en QA Metrics hoy. Gracias.`
  );
}

export default function AdminCargaDiariaPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(todayIso());
  const [data, setData] = useState<DailyLoadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "complete">("all");
  const [toast, setToast] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, feedback: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(feedback);
      setTimeout(() => setToast(null), 2200);
    } catch {
      setToast("No se pudo copiar al portapapeles");
      setTimeout(() => setToast(null), 2200);
    }
  }, []);

  const fetchData = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<DailyLoadResponse>(`/api/admin/daily-load?date=${d}`);
      setData(res);
    } catch (e: any) {
      if (e?.status === 403) setError("No autorizado (solo ADMIN)");
      else setError(e?.message ?? "Error al cargar");
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(date);
  }, [date, fetchData]);

  const summary = useMemo(() => {
    if (!data) return { dailyOk: 0, actOk: 0, none: 0, total: 0, complete: 0 };
    const total = data.rows.length;
    const dailyOk = data.rows.filter((r) => r.daily.loaded).length;
    const actOk = data.rows.filter((r) => r.activities.loaded).length;
    const none = data.rows.filter((r) => !r.daily.loaded && !r.activities.loaded).length;
    const complete = data.rows.filter((r) => r.daily.loaded && r.activities.loaded).length;
    return { dailyOk, actOk, none, total, complete };
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.rows;
    if (filter === "pending") return data.rows.filter((r) => !r.daily.loaded || !r.activities.loaded);
    return data.rows.filter((r) => r.daily.loaded && r.activities.loaded);
  }, [data, filter]);

  const isToday = date === todayIso();

  if (user && user.role?.name !== "ADMIN") {
    return (
      <div className="max-w-md mx-auto mt-24 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          {iconAlert}
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Acceso restringido</h1>
        <p className="mt-1 text-sm text-gray-500">Esta vista es exclusiva para administradores.</p>
      </div>
    );
  }

  const dailyPct = summary.total > 0 ? Math.round((summary.dailyOk / summary.total) * 100) : 0;
  const actPct = summary.total > 0 ? Math.round((summary.actOk / summary.total) * 100) : 0;
  const completePct = summary.total > 0 ? Math.round((summary.complete / summary.total) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">
            <span>Admin</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">Carga diaria</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Carga diaria por usuario</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {data ? (
              <span className="first-letter:uppercase">
                {formatLongDate(data.date)}
                {isToday && <span className="ml-2 text-[#2E5FA3] font-medium">• Hoy</span>}
              </span>
            ) : (
              "Cargando fecha…"
            )}
          </p>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setDate((d) => shiftIso(d, -1))}
            aria-label="Día anterior"
            className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            {iconChevronLeft}
          </button>
          <label className="flex items-center gap-1.5 px-2 h-7 rounded hover:bg-gray-50 cursor-pointer">
            <span className="text-gray-400">{iconCalendar}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-[11px] font-mono text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => setDate((d) => shiftIso(d, 1))}
            aria-label="Día siguiente"
            className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            {iconChevronRight}
          </button>
          <button
            type="button"
            onClick={() => setDate(todayIso())}
            disabled={isToday}
            className="px-2.5 h-7 text-[11px] font-medium rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-default transition"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Non-business-day full-state (suplanta KPIs, filtros y filas) */}
      {data?.isNonBusinessDay && !loading && (
        <div className="rounded-md border border-dashed border-amber-200 bg-amber-50/50 px-6 py-16 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            {iconAlert}
          </div>
          <h2 className="mt-4 text-base font-semibold text-amber-900">Día no laborable</h2>
          <p className="mt-1 text-xs text-amber-800/80 max-w-sm mx-auto">
            {formatLongDate(data.date)} es feriado o fin de semana. No se espera carga del equipo, por lo que no se muestran registros.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">
          {error}
        </div>
      )}

      {/* KPI cards */}
      {!loading && data && !data.isNonBusinessDay && summary.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <KpiCard
            label="Registros diarios"
            value={summary.dailyOk}
            total={summary.total}
            pct={dailyPct}
            accent="emerald"
            icon={iconClipboard}
          />
          <KpiCard
            label="Actividades"
            value={summary.actOk}
            total={summary.total}
            pct={actPct}
            accent="sky"
            icon={iconBolt}
          />
          <KpiCard
            label="Cumplimiento total"
            value={summary.complete}
            total={summary.total}
            pct={completePct}
            accent="indigo"
            icon={iconCheck}
          />
        </div>
      )}

      {/* Filter chips + bulk actions */}
      {!loading && data && !data.isNonBusinessDay && summary.total > 0 && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              Todos <span className="ml-1 text-gray-400">{summary.total}</span>
            </FilterTab>
            <FilterTab active={filter === "pending"} onClick={() => setFilter("pending")}>
              Pendientes <span className="ml-1 text-gray-400">{summary.total - summary.complete}</span>
            </FilterTab>
            <FilterTab active={filter === "complete"} onClick={() => setFilter("complete")}>
              Completos <span className="ml-1 text-gray-400">{summary.complete}</span>
            </FilterTab>
          </div>
          <div className="flex items-center gap-2">
            {summary.total - summary.complete > 0 && (
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    buildAllPendingMessage(data.rows, data.date),
                    `Lista de ${summary.total - summary.complete} pendientes copiada`
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-medium rounded border border-gray-200 bg-white text-gray-700 hover:border-[#2E5FA3] hover:text-[#2E5FA3] transition"
              >
                {iconCopy}
                Copiar lista de pendientes
              </button>
            )}
            <div className="text-[11px] text-gray-400">
              {visibleRows.length} de {summary.total} analista{summary.total !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && data && !data.isNonBusinessDay && data.rows.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">No hay analistas con Tester vinculado.</p>
        </div>
      )}

      {/* Rows */}
      {!loading && data && !data.isNonBusinessDay && visibleRows.length > 0 && (
        <div className="space-y-1.5">
          {visibleRows.map((r) => (
            <UserRow
              key={r.userId}
              row={r}
              dateIso={data.date}
              onCopyMessage={() =>
                copyToClipboard(
                  buildReminderMessage(r, data.date),
                  `Mensaje para ${r.userName.split(/\s+/)[0]} copiado`
                )
              }
              onMailTo={() => {
                const subject = encodeURIComponent(
                  `Carga QA pendiente — ${formatLongDate(data.date)}`
                );
                const body = encodeURIComponent(buildReminderMessage(r, data.date));
                window.location.href = `mailto:${r.userEmail}?subject=${subject}&body=${body}`;
              }}
            />
          ))}
        </div>
      )}

      {/* No rows under current filter */}
      {!loading && data && !data.isNonBusinessDay && data.rows.length > 0 && visibleRows.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-500">
            {filter === "pending"
              ? "Sin pendientes. Todo el equipo cargó."
              : "Nadie ha completado ambos registros."}
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gray-900 text-white text-xs font-medium rounded-md shadow-lg px-3.5 py-2.5 flex items-center gap-2">
            <span className="text-emerald-400">{iconCheck}</span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function KpiCard({
  label, value, total, pct, accent, icon,
}: {
  label: string; value: number; total: number; pct: number;
  accent: "emerald" | "sky" | "indigo"; icon: React.ReactNode;
}) {
  const accentMap = {
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-500" },
    sky:     { text: "text-sky-600",     bg: "bg-sky-50",     bar: "bg-sky-500" },
    indigo:  { text: "text-[#2E5FA3]",   bg: "bg-indigo-50",  bar: "bg-[#2E5FA3]" },
  }[accent];

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 hover:border-gray-300 transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
            <span className="text-xs text-gray-400">/ {total}</span>
          </div>
        </div>
        <div className={`w-8 h-8 rounded-md ${accentMap.bg} ${accentMap.text} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-gray-400">{pct}%</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400 tabular-nums">{total - value} restante{total - value !== 1 ? "s" : ""}</span>
        </div>
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${accentMap.bar} transition-[width] duration-500 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-medium rounded transition ${
        active ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function UserRow({
  row, dateIso, onCopyMessage, onMailTo,
}: {
  row: DailyLoadRow;
  dateIso: string;
  onCopyMessage: () => void;
  onMailTo: () => void;
}) {
  const status = rowStatus(row);
  const border = {
    complete: "border-l-emerald-400",
    partial:  "border-l-amber-300",
    none:     "border-l-gray-200",
  }[status];
  const isPending = status !== "complete";

  return (
    <div
      className={`group bg-white rounded-md border border-gray-200 border-l-[3px] ${border} px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all`}
    >
      <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
        {/* Avatar + identity */}
        <div className="flex items-center gap-3 min-w-[180px] flex-1">
          <div className="w-9 h-9 rounded-full bg-[#1F3864] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            {initials(row.userName)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900 truncate">{row.userName}</div>
            <div className="text-[11px] text-gray-400 truncate">{row.userEmail}</div>
          </div>
        </div>

        {/* Daily record cell */}
        <StateCell
          label="Diario"
          loaded={row.daily.loaded}
          lastAt={row.daily.lastAt}
          detail={
            row.daily.loaded ? (
              <>
                <Stat n={row.daily.storiesCount} l="HU" />
                <Stat n={row.daily.designed} l="Dis" tone="sky" />
                <Stat n={row.daily.executed} l="Eje" tone="emerald" />
                <Stat n={row.daily.defects} l="Def" tone="rose" />
              </>
            ) : null
          }
          emptyLabel="Sin registros"
        />

        {/* Activity cell */}
        <StateCell
          label="Actividades"
          loaded={row.activities.loaded}
          lastAt={row.activities.lastAt}
          detail={
            row.activities.loaded ? (
              <Stat n={Number(row.activities.hours.toFixed(1))} l="hrs" tone="sky" />
            ) : null
          }
          emptyLabel="Sin actividades"
        />

        {/* Actions — only visible for pending users */}
        {isPending && (
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={onCopyMessage}
              title="Copiar mensaje de recordatorio"
              aria-label="Copiar mensaje"
              className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:border-[#2E5FA3] hover:text-[#2E5FA3] transition"
            >
              {iconCopy}
            </button>
            <button
              type="button"
              onClick={onMailTo}
              title={`Enviar correo a ${row.userEmail}`}
              aria-label="Enviar correo"
              className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:border-[#2E5FA3] hover:text-[#2E5FA3] transition"
            >
              {iconMail}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StateCell({
  label, loaded, lastAt, detail, emptyLabel,
}: {
  label: string;
  loaded: boolean;
  lastAt: string | null;
  detail: React.ReactNode;
  emptyLabel: string;
}) {
  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center gap-2">
        <StatusPill loaded={loaded} label={label} />
        {loaded && lastAt && (
          <span className="text-[10px] text-gray-400 font-mono">{formatTime(lastAt)}</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        {loaded ? (
          <div className="flex items-center gap-2 flex-wrap">{detail}</div>
        ) : (
          <span className="text-[11px] text-gray-400 italic">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ loaded, label }: { loaded: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${
        loaded
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-gray-50 text-gray-500 border-gray-200"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
          loaded ? "bg-emerald-500 text-white" : "bg-gray-300 text-white"
        }`}
      >
        {loaded ? iconCheck : iconDash}
      </span>
      {label}
    </span>
  );
}

function Stat({
  n, l, tone = "slate",
}: {
  n: number; l: string; tone?: "slate" | "sky" | "emerald" | "rose";
}) {
  const toneMap = {
    slate:   "bg-gray-50 text-gray-700 border-gray-200",
    sky:     "bg-sky-50 text-sky-700 border-sky-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose:    "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${toneMap}`}>
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{l}</span>
    </span>
  );
}
