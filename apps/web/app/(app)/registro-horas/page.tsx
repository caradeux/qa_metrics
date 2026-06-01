"use client";

import { useCallback, useEffect, useState } from "react";
import { flowpilotApi, ApiError, type FlowpilotDayPreview, type FlowpilotPreviewEntry } from "@/lib/api-client";

function todayIso() { return new Date().toISOString().slice(0, 10); }
function shiftIso(iso: string, d: number) {
  const x = new Date(`${iso}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10);
}
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Dom..6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function RegistroHorasPage() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<FlowpilotDayPreview | null>(null);
  const [rows, setRows] = useState<FlowpilotPreviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [week, setWeek] = useState<{ date: string; hasData: boolean; sent: boolean }[]>([]);

  const load = useCallback((d: string) => {
    setLoading(true); setError(null);
    flowpilotApi.preview(d)
      .then((p) => { setData(p); setRows(p.entries); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) setNeedsConnect(true);
        else setError(e?.message ?? "Error");
      })
      .finally(() => setLoading(false));
  }, []);

  const loadWeek = useCallback((ws: string) => {
    flowpilotApi.pending({ from: ws, to: shiftIso(ws, 4) }).then((r) => setWeek(r.days)).catch(() => {});
  }, []);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => { loadWeek(weekStart); }, [weekStart, loadWeek]);

  const total = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const allMapped = rows.every((r) => r.mapped);
  const overCap = total > 8 + 1e-9;
  const isSent = data?.sync?.status === "SENT";
  const canSend = !sending && rows.length > 0 && allMapped && !overCap;

  const setHours = (i: number, v: number) =>
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, hours: v } : r));
  const setDesc = (i: number, v: string) =>
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, description: v } : r));

  const send = async () => {
    setSending(true); setError(null);
    try {
      await flowpilotApi.sync(date, rows.map((r) => ({ kind: r.kind, description: r.description, hours: r.hours })));
      setToast("Día enviado a FlowPilot");
      setTimeout(() => setToast(null), 2500);
      load(date);
      loadWeek(weekStart);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) setNeedsConnect(true);
      else setError(e?.message ?? "Error al enviar");
    } finally { setSending(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Registro de Horas</div>
          <h1 className="text-xl font-bold text-gray-900">Mis horas del día → FlowPilot</h1>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
          <button onClick={() => setDate((d) => shiftIso(d, -1))} className="px-2 h-7 text-gray-500 hover:bg-gray-100 rounded">‹</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-[11px] font-mono px-2 h-7 bg-transparent outline-none" />
          <button onClick={() => setDate((d) => shiftIso(d, 1))} className="px-2 h-7 text-gray-500 hover:bg-gray-100 rounded">›</button>
          <button onClick={() => setDate(todayIso())} className="px-2 h-7 text-[11px] text-gray-600 hover:bg-gray-100 rounded">Hoy</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}
      <WeekStrip
        weekStart={weekStart}
        week={week}
        selected={date}
        today={todayIso()}
        onPrev={() => setWeekStart((w) => shiftIso(w, -7))}
        onNext={() => setWeekStart((w) => shiftIso(w, 7))}
        onThis={() => setWeekStart(mondayOf(todayIso()))}
        onPick={(d) => setDate(d)}
      />

      {isSent && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Ya enviado a FlowPilot ({data!.sync!.hoursTotal}h)
        </div>
      )}

      {loading ? (
        <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {rows.length === 0 && <div className="text-sm text-gray-400 italic">No hay actividades ni trabajo en HU registrados para este día.</div>}
            {rows.map((r, i) => (
              <div key={r.source + r.refId} className={`flex items-center gap-3 bg-white border rounded-md px-4 py-2.5 ${r.mapped ? "border-gray-200" : "border-amber-300 bg-amber-50/40"}`}>
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${r.source === "story" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{r.source === "story" ? "HU" : "Act"}</span>
                <input value={r.description} onChange={(e) => setDesc(i, e.target.value)} className="flex-1 text-sm border border-transparent hover:border-gray-200 focus:border-[#4A90D9] rounded px-2 py-1 outline-none" />
                {!r.mapped && <span className="text-[10px] text-amber-700 font-medium">sin homologar ({r.kind})</span>}
                <input type="number" step="0.5" min="0" max="8" value={r.hours} onChange={(e) => setHours(i, Number(e.target.value))} className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-right outline-none focus:border-[#4A90D9]" />
                <span className="text-[11px] text-gray-400">h</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className={`text-sm font-semibold ${overCap ? "text-red-600" : "text-gray-700"}`}>
              Total: {total.toFixed(1)} / 8h {overCap && "· supera la jornada"}
            </div>
            <button onClick={() => { if (isSent) setConfirmResend(true); else send(); }} disabled={!canSend} className="bg-[#2E5FA3] text-white text-sm rounded-md px-4 py-2 disabled:opacity-40 hover:bg-[#264f88]">
              {sending ? "Enviando…" : isSent ? "Reenviar a FlowPilot" : "Enviar a FlowPilot"}
            </button>
          </div>
          {!allMapped && rows.length > 0 && <div className="mt-2 text-[12px] text-amber-700">Hay entradas sin homologar — pide a un admin configurarlas en Homologación FlowPilot.</div>}
        </>
      )}

      {needsConnect && (
        <ConnectModal onClose={() => setNeedsConnect(false)} onConnected={() => { setNeedsConnect(false); load(date); }} />
      )}
      {confirmResend && (
        <ConfirmResendModal
          previousHours={data?.sync?.hoursTotal ?? 0}
          newHours={total}
          onCancel={() => setConfirmResend(false)}
          onConfirm={() => { setConfirmResend(false); send(); }}
        />
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs rounded-md px-3.5 py-2.5">{toast}</div>}
    </div>
  );
}

function WeekStrip({
  weekStart, week, selected, today, onPrev, onNext, onThis, onPick,
}: {
  weekStart: string;
  week: { date: string; hasData: boolean; sent: boolean }[];
  selected: string;
  today: string;
  onPrev: () => void; onNext: () => void; onThis: () => void; onPick: (d: string) => void;
}) {
  const byDate = new Map(week.map((d) => [d.date, d]));
  const days = Array.from({ length: 5 }, (_, i) => shiftIso(weekStart, i));
  const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const monthLabel = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" });

  return (
    <div className="mb-5 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Calendario de carga · <span className="normal-case text-gray-700 first-letter:uppercase">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} aria-label="Semana anterior" className="w-6 h-6 rounded text-gray-500 hover:bg-gray-100">‹</button>
          <button onClick={onThis} className="px-2 h-6 text-[11px] text-gray-600 rounded hover:bg-gray-100">Esta semana</button>
          <button onClick={onNext} aria-label="Semana siguiente" className="w-6 h-6 rounded text-gray-500 hover:bg-gray-100">›</button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((d, i) => {
          const st = byDate.get(d);
          const isFuture = d > today;
          const dayNum = Number(d.slice(8, 10));
          let cls = "border-gray-200 bg-white"; let label = "Sin datos"; let dot = "bg-gray-300"; let txt = "text-gray-400";
          if (!st) { cls = "border-dashed border-gray-200 bg-gray-50"; label = "No laborable"; dot = "bg-gray-200"; txt = "text-gray-300"; }
          else if (st.sent) { cls = "border-emerald-200 bg-emerald-50"; label = "Cargado"; dot = "bg-emerald-500"; txt = "text-emerald-700"; }
          else if (st.hasData) { cls = "border-amber-300 bg-amber-50"; label = "Pendiente"; dot = "bg-amber-500"; txt = "text-amber-700"; }
          else if (isFuture) { cls = "border-gray-100 bg-white"; label = "—"; dot = "bg-gray-200"; txt = "text-gray-300"; }
          const sel = d === selected ? "ring-2 ring-[#2E5FA3] ring-offset-1" : "";
          return (
            <button key={d} onClick={() => onPick(d)} className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition hover:shadow-sm ${cls} ${sel}`}>
              <span className="text-[9px] uppercase tracking-wider text-gray-400">{DOW[i]}</span>
              <span className={`text-lg font-bold leading-none ${txt}`}>{dayNum}</span>
              <span className={`flex items-center gap-1 text-[9px] font-semibold ${txt}`}><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Cargado</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pendiente</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Sin datos</span>
      </div>
    </div>
  );
}

function ConfirmResendModal({
  previousHours, newHours, onCancel, onConfirm,
}: {
  previousHours: number; newHours: number; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[460px] overflow-hidden border-t-4 border-amber-500 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado de advertencia */}
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">¿Reenviar este día?</h2>
            <p className="text-[12px] text-amber-700 font-medium mt-0.5">Este día YA fue registrado en FlowPilot</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            Para evitar <span className="font-semibold">doble registro</span>, al reenviar se{" "}
            <span className="font-semibold">eliminan</span> las {previousHours}h ya cargadas y se{" "}
            <span className="font-semibold">reemplazan</span> por las {newHours.toFixed(1)}h actuales.
            La acción no se puede deshacer.
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onCancel} className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="text-sm font-semibold px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 shadow-sm">
            Sí, reemplazar y reenviar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!password) { setErr("Ingresa tu clave de FlowPilot"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await flowpilotApi.connect(password);
      if (r.valid) onConnected(); else setErr("Credencial inválida");
    } catch (e: any) { setErr(e?.message ?? "No se pudo conectar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">Conectar con FlowPilot</h2>
        <p className="text-xs text-gray-500">Ingresa tu clave de FlowPilot para enviar tus horas.</p>
        <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Clave de FlowPilot" />
        {err && <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600">Cancelar</button>
          <button onClick={submit} disabled={busy} className="text-sm px-3 py-1.5 rounded bg-[#2E5FA3] text-white disabled:opacity-50">{busy ? "Conectando…" : "Conectar"}</button>
        </div>
      </div>
    </div>
  );
}
