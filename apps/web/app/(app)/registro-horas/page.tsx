"use client";

import { useCallback, useEffect, useState } from "react";
import { flowpilotApi, ApiError, type FlowpilotDayPreview, type FlowpilotPreviewEntry } from "@/lib/api-client";

function todayIso() { return new Date().toISOString().slice(0, 10); }
function shiftIso(iso: string, d: number) {
  const x = new Date(`${iso}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10);
}

export default function RegistroHorasPage() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<FlowpilotDayPreview | null>(null);
  const [rows, setRows] = useState<FlowpilotPreviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => { load(date); }, [date, load]);

  const total = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const allMapped = rows.every((r) => r.mapped);
  const overCap = total > 8 + 1e-9;
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
      {data?.sync?.status === "SENT" && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] text-emerald-800">Ya enviado ({data.sync.hoursTotal}h). Reenviar reemplaza lo anterior.</div>}

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
            <button onClick={send} disabled={!canSend} className="bg-[#2E5FA3] text-white text-sm rounded-md px-4 py-2 disabled:opacity-40 hover:bg-[#264f88]">
              {sending ? "Enviando…" : "Enviar a FlowPilot"}
            </button>
          </div>
          {!allMapped && rows.length > 0 && <div className="mt-2 text-[12px] text-amber-700">Hay entradas sin homologar — pide a un admin configurarlas en Homologación FlowPilot.</div>}
        </>
      )}

      {needsConnect && (
        <ConnectModal onClose={() => setNeedsConnect(false)} onConnected={() => { setNeedsConnect(false); load(date); }} />
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs rounded-md px-3.5 py-2.5">{toast}</div>}
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
