"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flowpilotApi, type FlowpilotMonthData, type FlowpilotDayStatus } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function formatMonthLong(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}
function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0=Dom … 6=Sáb (UTC)
}
function weekdayInitial(iso: string) {
  return ["D", "L", "M", "M", "J", "V", "S"][weekday(iso)];
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

// Color de relleno por estado de un día laborable. Paleta alineada a tokens.
const FILL: Record<FlowpilotDayStatus, { bg: string; label: string }> = {
  sent:    { bg: "bg-emerald-500", label: "Enviado a FlowPilot" },
  partial: { bg: "bg-yellow-400",  label: "Envío parcial" },
  missing: { bg: "bg-orange-500",  label: "Sin enviar" },
  future:  { bg: "bg-gray-100",    label: "Aún no vence" },
  off:     { bg: "bg-gray-100",    label: "—" },
};

export default function FlowpilotControlPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<FlowpilotMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((mo: string) => {
    setLoading(true); setError(null);
    flowpilotApi.adminMonth(mo)
      .then(setData)
      .catch((e) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(month); }, [month, load]);

  const isThisMonth = month === currentMonth();

  // Cobertura del equipo sobre los días hábiles ya transcurridos.
  const coverage = useMemo(() => {
    if (!data) return null;
    const expected = data.summary.analysts * data.summary.businessDaysToDate;
    if (expected <= 0) return null;
    let sent = 0;
    for (const r of data.rows) for (const st of Object.values(r.statusByDay)) if (st === "sent") sent++;
    return Math.round((sent / expected) * 100);
  }, [data]);

  if (user && !can("flowpilot-control", "read")) {
    return <div className="max-w-md mx-auto mt-24 text-center text-sm text-gray-500">No tienes permiso para ver el control de FlowPilot.</div>;
  }

  const s = data?.summary;

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Admin · FlowPilot</div>
          <h1 className="text-xl font-bold text-gray-900">Control de carga de horas</h1>
          <p className="text-xs text-gray-400 mt-0.5 first-letter:uppercase">
            {data ? formatMonthLong(data.month) : "Cargando…"}
            {isThisMonth && <span className="ml-2 text-[#2E5FA3] font-medium">· Mes en curso</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <button aria-label="Mes anterior" onClick={() => setMonth((mo) => shiftMonth(mo, -1))} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:scale-95">‹</button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="text-[11px] font-mono text-gray-700 px-2 h-7 bg-transparent outline-none" />
          <button aria-label="Mes siguiente" onClick={() => setMonth((mo) => shiftMonth(mo, 1))} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:scale-95">›</button>
          <button onClick={() => setMonth(currentMonth())} disabled={isThisMonth} className="px-2.5 h-7 text-[11px] font-medium rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40">Hoy</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}

      {s && !loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Kpi label="Cobertura del equipo" hint={`${s.businessDaysToDate} días hábiles a hoy`}>
            {coverage == null
              ? <span className="text-2xl font-bold text-gray-400">—</span>
              : <span className={`text-2xl font-bold tabular-nums ${coverage >= 90 ? "text-emerald-600" : coverage >= 60 ? "text-yellow-600" : "text-orange-600"}`}>{coverage}<span className="text-base">%</span></span>}
          </Kpi>
          <Kpi label="Días faltantes" hint="días hábiles sin enviar">
            <span className={`text-2xl font-bold tabular-nums ${s.totalMissing > 0 ? "text-orange-600" : "text-emerald-600"}`}>{s.totalMissing}</span>
          </Kpi>
          <Kpi label="Analistas al día" hint={`de ${s.analysts}`}>
            <span className={`text-2xl font-bold tabular-nums ${s.onTrack === s.analysts ? "text-emerald-600" : "text-gray-800"}`}>{s.onTrack}<span className="text-base text-gray-400">/{s.analysts}</span></span>
          </Kpi>
        </div>
      )}

      {loading ? (
        <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No hay analistas con Tester vinculado.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px] px-4 py-2 border-b border-r border-gray-200 min-w-[190px]">Analista</th>
                  {data.days.map((d) => {
                    const isToday = d.date === data.today;
                    const weekendHdr = !d.isBusinessDay;
                    return (
                      <th key={d.day} className={`py-1.5 text-center min-w-[26px] border-b border-r border-gray-200 ${weekendHdr ? "bg-red-50" : "bg-gray-50"}`}>
                        <div className={`text-[9px] uppercase leading-none mb-1 ${weekendHdr ? "text-red-300" : "text-gray-300"}`}>{weekdayInitial(d.date)}</div>
                        {isToday ? (
                          <div className="mx-auto w-[20px] h-[20px] rounded-full bg-[#2E5FA3] text-white text-[11px] font-bold flex items-center justify-center">{d.day}</div>
                        ) : (
                          <div className={`text-[11px] leading-tight tabular-nums ${weekendHdr ? "text-red-400 font-medium" : "text-gray-500 font-medium"}`}>{d.day}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.userId} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 px-4 py-2 border-b border-r border-gray-200 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1F3864] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{initials(r.userName)}</div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[12px] text-gray-900 truncate leading-tight">{r.userName}</div>
                          <div className="text-[10px] text-gray-400 truncate leading-tight">{r.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    {data.days.map((d) => {
                      const isToday = d.date === data.today;
                      const todayRing = isToday ? "outline outline-1 -outline-offset-1 outline-[#2E5FA3]/40" : "";
                      if (!d.isBusinessDay) {
                        // Sábado, domingo y feriado → rojo (no laborable), todos marcados con ×.
                        return (
                          <td key={d.day} title={`${d.date} — ${d.isHoliday ? "Feriado" : "Fin de semana"}`} className={`h-8 text-center align-middle border-b border-r border-gray-200 bg-red-400 ${todayRing}`}>
                            <span className="text-white text-[13px] font-bold leading-none select-none">×</span>
                          </td>
                        );
                      }
                      const st = (r.statusByDay[d.day] ?? "missing") as FlowpilotDayStatus;
                      const meta = FILL[st];
                      return <td key={d.day} title={`${d.date} — ${meta.label}`} className={`h-8 border-b border-r border-gray-200 ${meta.bg} ${todayRing}`} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 flex-wrap px-4 py-3 border-t border-gray-100 bg-gray-50/40 text-[11px] text-gray-500">
            <Legend sq="bg-emerald-500">Enviado</Legend>
            <Legend sq="bg-yellow-400">Parcial</Legend>
            <Legend sq="bg-orange-500">Sin enviar</Legend>
            <Legend sq="bg-gray-100">Aún no vence</Legend>
            <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-[3px] bg-red-400 inline-flex items-center justify-center text-white text-[10px] font-bold leading-none">×</span>No laborable (finde / feriado)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">{label}</div>
      <div className="mt-1.5 flex items-baseline">{children}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function Legend({ sq, children }: { sq: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3.5 h-3.5 rounded-[3px] ${sq}`} />{children}
    </span>
  );
}
