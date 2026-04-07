"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

interface Client { id: string; name: string; }
interface Project { id: string; name: string; modality: string; }
interface Cycle { id: string; name: string; }
interface Tester { id: string; name: string; }

interface TesterRecord {
  testerId: string;
  testerName: string;
  designedTotal: number;
  executedTotal: number;
  defectsCritical: number;
  defectsHigh: number;
  defectsMedium: number;
  defectsLow: number;
  hasExisting: boolean;
}

function emptyRecord(tester: Tester): TesterRecord {
  return { testerId: tester.id, testerName: tester.name, designedTotal: 0, executedTotal: 0, defectsCritical: 0, defectsHigh: 0, defectsMedium: 0, defectsLow: 0, hasExisting: false };
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ManualEntryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [records, setRecords] = useState<TesterRecord[]>([]);
  const [activeTester, setActiveTester] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { apiClient<Client[]>("/api/clients").then(setClients).catch(() => setClients([])); }, []);
  useEffect(() => {
    if (!clientId) { setProjects([]); return; }
    apiClient<Project[]>(`/api/projects?clientId=${clientId}`).then((all) => setProjects(all.filter(p => p.modality === "MANUAL"))).catch(() => setProjects([]));
    setProjectId(""); setCycleId(""); setWeekStart("");
  }, [clientId]);
  useEffect(() => {
    if (!projectId) { setCycles([]); setTesters([]); return; }
    Promise.all([apiClient<Cycle[]>(`/api/cycles?projectId=${projectId}`), apiClient<Tester[]>(`/api/testers?projectId=${projectId}`)]).then(([c, t]) => { setCycles(c); setTesters(t); }).catch(() => { setCycles([]); setTesters([]); });
    setCycleId(""); setWeekStart("");
  }, [projectId]);

  const loadRecords = useCallback(async () => {
    if (!cycleId || !weekStart || testers.length === 0) { setRecords([]); return; }
    const newRecords = testers.map(t => emptyRecord(t));
    for (const rec of newRecords) {
      try {
        const data = await apiClient<any[]>(`/api/records?testerId=${rec.testerId}&cycleId=${cycleId}&weekStart=${weekStart}`);
        if (data.length > 0) { const e = data[0]; rec.designedTotal = e.designedTotal; rec.executedTotal = e.executedTotal; rec.defectsCritical = e.defectsCritical; rec.defectsHigh = e.defectsHigh; rec.defectsMedium = e.defectsMedium; rec.defectsLow = e.defectsLow; rec.hasExisting = true; }
      } catch { /* ignore */ }
    }
    setRecords(newRecords); setActiveTester(0); setSaveStatus("idle");
  }, [cycleId, weekStart, testers]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const doSave = useCallback(async () => {
    if (!cycleId || !weekStart || records.length === 0) return;
    setSaveStatus("saving");
    try {
      const payload = { records: records.map(r => ({ testerId: r.testerId, cycleId, weekStart, designedFunctional: r.designedTotal, designedRegression: 0, designedSmoke: 0, designedExploratory: 0, executedFunctional: r.executedTotal, executedRegression: 0, executedSmoke: 0, executedExploratory: 0, defectsCritical: r.defectsCritical, defectsHigh: r.defectsHigh, defectsMedium: r.defectsMedium, defectsLow: r.defectsLow })) };
      await apiClient("/api/records", { method: "POST", body: JSON.stringify(payload) });
      setSaveStatus("saved"); setLastSaved(new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })); setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [records, cycleId, weekStart]);

  function triggerAutoSave() { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(doSave, 1500); }
  function updateField(field: keyof TesterRecord, value: number) {
    setRecords(prev => { const copy = [...prev]; copy[activeTester] = { ...copy[activeTester], [field]: Math.max(0, value) }; return copy; });
    triggerAutoSave();
  }

  const rec = records[activeTester];
  const dt = (r: TesterRecord) => r.defectsCritical + r.defectsHigh + r.defectsMedium + r.defectsLow;
  const ratio = (r: TesterRecord) => r.designedTotal > 0 ? Math.round((r.executedTotal / r.designedTotal) * 100) : 0;
  const totalDesigned = records.reduce((s, r) => s + r.designedTotal, 0);
  const totalExecuted = records.reduce((s, r) => s + r.executedTotal, 0);
  const totalDefects = records.reduce((s, r) => s + dt(r), 0);

  const sel = "w-full px-2.5 py-[7px] bg-white border border-gray-200 rounded text-[13px] text-gray-800 focus:border-[#4A90D9] focus:ring-1 focus:ring-[#4A90D9]/20 transition outline-none disabled:opacity-40 disabled:bg-gray-50";

  const ready = records.length > 0 && rec;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: selectors + save status */}
      <div className="flex items-end gap-2 pb-4 border-b border-gray-200 mb-4">
        <div className="flex-1 grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={sel}>
              <option value="">Seleccionar...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Proyecto</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!clientId} className={sel}>
              <option value="">Seleccionar...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ciclo</label>
            <select value={cycleId} onChange={e => setCycleId(e.target.value)} disabled={!projectId} className={sel}>
              <option value="">Seleccionar...</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Semana</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} disabled={!cycleId} className={sel} />
          </div>
        </div>
        {/* Save indicator */}
        <div className="shrink-0 pb-0.5">
          {saveStatus === "saving" && <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando</span>}
          {saveStatus === "saved" && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Guardado</span>}
          {saveStatus === "error" && <span className="text-[11px] text-red-500">Error</span>}
          {saveStatus === "idle" && lastSaved && <span className="text-[10px] text-gray-300">{lastSaved}</span>}
        </div>
      </div>

      {!ready && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            </div>
            <p className="text-sm font-medium text-gray-400">Registro Semanal</p>
            <p className="text-xs text-gray-300 mt-1">Selecciona cliente, proyecto, ciclo y semana</p>
          </div>
        </div>
      )}

      {ready && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* LEFT: Main data entry */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
            {/* Tester tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto shrink-0">
              {records.map((r, idx) => {
                const active = idx === activeTester;
                const hasData = r.designedTotal > 0 || r.executedTotal > 0 || dt(r) > 0;
                return (
                  <button key={r.testerId} onClick={() => setActiveTester(idx)}
                    className={`shrink-0 px-3 py-1.5 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${active ? "bg-[#1F3864] text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {r.testerName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </span>
                    {r.testerName}
                    {hasData && !active && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/>}
                  </button>
                );
              })}
            </div>

            {/* Diseñados + Ejecutados side by side */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Diseñados */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-[#2E5FA3]/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#2E5FA3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Diseñados</p>
                  </div>
                  <span className="font-mono text-xl font-bold text-[#2E5FA3]">{rec.designedTotal}</span>
                </div>
                <input type="number" min={0} value={rec.designedTotal}
                  onChange={e => updateField("designedTotal", parseInt(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  className="w-full px-3 py-3 text-center font-mono text-2xl font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-md focus:border-[#2E5FA3] focus:bg-white focus:ring-0 transition outline-none" placeholder="0" />
                <p className="text-[10px] text-gray-300 mt-2 text-center">Casos de prueba creados</p>
              </div>

              {/* Ejecutados */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Ejecutados</p>
                  </div>
                  <span className="font-mono text-xl font-bold text-emerald-600">{rec.executedTotal}</span>
                  {rec.designedTotal > 0 && <span className="text-[10px] text-gray-400 ml-1">{ratio(rec)}%</span>}
                </div>
                <input type="number" min={0} value={rec.executedTotal}
                  onChange={e => updateField("executedTotal", parseInt(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  className="w-full px-3 py-3 text-center font-mono text-2xl font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-md focus:border-emerald-500 focus:bg-white focus:ring-0 transition outline-none" placeholder="0" />
                {rec.designedTotal > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ratio(rec))}%` }} />
                  </div>
                )}
                {!rec.designedTotal && <p className="text-[10px] text-gray-300 mt-2 text-center">Casos ejecutados</p>}
              </div>
            </div>

            {/* Defectos - compact row */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider flex-1">Defectos</p>
                <span className="font-mono text-xl font-bold text-red-500">{dt(rec)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { field: "defectsCritical" as const, label: "Critico", color: "#991b1b", ring: "focus:border-[#991b1b]" },
                  { field: "defectsHigh" as const, label: "Alto", color: "#ef4444", ring: "focus:border-[#ef4444]" },
                  { field: "defectsMedium" as const, label: "Medio", color: "#f59e0b", ring: "focus:border-[#f59e0b]" },
                  { field: "defectsLow" as const, label: "Bajo", color: "#84cc16", ring: "focus:border-[#84cc16]" },
                ]).map(({ field, label, color, ring }) => (
                  <div key={field}>
                    <div className="flex items-center justify-center gap-1 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                    </div>
                    <input type="number" min={0} value={rec[field]}
                      onChange={e => updateField(field, parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className={`w-full px-2 py-2 text-center font-mono text-lg font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-0 transition outline-none ${ring}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Team panel */}
          <div className="w-64 shrink-0 flex flex-col gap-3">
            {/* Team summary */}
            <div className="bg-[#1F3864] rounded-lg p-4 text-white">
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider mb-3">Resumen del Equipo</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-mono text-lg font-bold">{totalDesigned}</p>
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">Dis.</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-bold">{totalExecuted}</p>
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">Ejec.</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-bold">{totalDefects}</p>
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">Def.</p>
                </div>
              </div>
              {totalDesigned > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 text-center">
                  <p className="font-mono text-2xl font-bold">{Math.round((totalExecuted / totalDesigned) * 100)}%</p>
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">Ratio Equipo</p>
                </div>
              )}
            </div>

            {/* Per-tester cards */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Por Tester</p>
              {records.map((r, idx) => {
                const active = idx === activeTester;
                const pct = r.designedTotal > 0 ? Math.round((r.executedTotal / r.designedTotal) * 100) : 0;
                return (
                  <button key={r.testerId} onClick={() => setActiveTester(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${active ? "border-[#2E5FA3] bg-[#2E5FA3]/5 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${active ? "bg-[#1F3864] text-white" : "bg-gray-100 text-gray-500"}`}>
                          {r.testerName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </span>
                        <span className="text-[11px] font-medium text-gray-800 truncate max-w-[120px]">{r.testerName}</span>
                      </div>
                      {r.hasExisting && <span className="text-[7px] bg-amber-100 text-amber-600 px-1 py-0.5 rounded font-bold uppercase">Ed</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : pct > 0 ? "bg-red-400" : "bg-gray-200"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-gray-500 w-8 text-right">{pct}%</span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[10px] font-mono">
                      <span className="text-[#2E5FA3]">{r.designedTotal} <span className="text-gray-300">dis</span></span>
                      <span className="text-emerald-600">{r.executedTotal} <span className="text-gray-300">eje</span></span>
                      {dt(r) > 0 && <span className="text-red-500">{dt(r)} <span className="text-gray-300">def</span></span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Save button */}
            <button onClick={doSave} disabled={saveStatus === "saving"}
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition-all disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm">
              {saveStatus === "saving" ? (
                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Guardar Todo</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
