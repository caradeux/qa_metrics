"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";

interface Assignment {
  id: string; startDate: string; endDate: string | null;
  status: string; notes: string | null;
  tester: { id: string; name: string; allocation?: number; project: { id: string; name: string; client: { name: string } } };
  cycle: { id: string; name: string };
  story: { id: string; title: string; designComplexity: string; executionComplexity: string };
}
interface Project { id: string; name: string; }

// Flujo de estados QA
const STATUSES = [
  { value: "REGISTERED", label: "Inicio", short: "INI", color: "#6b7280", bg: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400", step: 1 },
  { value: "ANALYSIS", label: "En Analisis", short: "ANA", color: "#8b5cf6", bg: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", step: 2 },
  { value: "TEST_DESIGN", label: "Diseno de Casos", short: "DIS", color: "#2E5FA3", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", step: 3 },
  { value: "WAITING_QA_DEPLOY", label: "Esperando Ambientación QA", short: "AMB", color: "#ea580c", bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", step: 4 },
  { value: "EXECUTION", label: "En Ejecucion", short: "EJE", color: "#0891b2", bg: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", step: 4 },
  { value: "RETURNED_TO_DEV", label: "Devuelto a Dev", short: "DEV", color: "#ef4444", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", step: 4 },
  { value: "WAITING_UAT", label: "Espera UAT", short: "ESP", color: "#f59e0b", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", step: 5 },
  { value: "UAT", label: "En UAT", short: "UAT", color: "#d946ef", bg: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", dot: "bg-fuchsia-500", step: 6 },
  { value: "PRODUCTION", label: "Produccion", short: "PRD", color: "#10b981", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", step: 7 },
  { value: "ON_HOLD", label: "Detenido", short: "HOLD", color: "#64748b", bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500", step: 9 },
] as const;

const ACTIVE_STATUSES = ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION"] as const;

const statusMap = Object.fromEntries(STATUSES.map(s => [s.value, s]));
const complexityBadge: Record<string, string> = { HIGH: "bg-red-100 text-red-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-green-100 text-green-700" };

function fmtDate(d: string) { return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short" }); }
function daysBetween(a: string, b: string) { return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)); }
function daysUntil(d: string) { return daysBetween(new Date().toISOString().split("T")[0], d); }

// Active = tester is currently working (not idle). Idle = liberated, available for other work.
function isActive(status: string) { return (ACTIVE_STATUSES as readonly string[]).includes(status); }

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { can } = usePermissions();

  const fetchAssignments = useCallback(async () => {
    const params = filterProject ? `?projectId=${filterProject}` : "";
    try {
      const data = await apiClient<Assignment[]>(`/api/assignments${params}`);
      setAssignments(data);
    } catch {
      setAssignments([]);
    }
    setLoading(false);
  }, [filterProject]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => { apiClient<Project[]>("/api/projects").then(setProjects).catch(() => setProjects([])); }, []);

  async function changeStatus(id: string, status: string) {
    const body: Record<string, unknown> = { status };
    if (status === "PRODUCTION") body.endDate = new Date().toISOString().split("T")[0];
    try {
      await apiClient(`/api/assignments/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } catch (err) {
      console.error(err);
    }
    fetchAssignments();
  }

  // Filter
  const filtered = filterStatus ? assignments.filter(a => a.status === filterStatus) : assignments;

  // Group by tester
  const groups = new Map<string, { name: string; allocation: number; project: string; client: string; assignments: Assignment[] }>();
  for (const a of filtered) {
    if (!groups.has(a.tester.id)) groups.set(a.tester.id, { name: a.tester.name, allocation: a.tester.allocation ?? 100, project: a.tester.project.name, client: a.tester.project.client.name, assignments: [] });
    groups.get(a.tester.id)!.assignments.push(a);
  }

  // ── RESUMEN GERENCIAL ──
  const totalHU = assignments.length;
  const byStatus = STATUSES.map(s => ({ ...s, count: assignments.filter(a => a.status === s.value).length }));
  const activeHU = assignments.filter(a => isActive(a.status)).length;
  const prodHU = assignments.filter(a => a.status === "PRODUCTION").length;
  const returnedHU = assignments.filter(a => a.status === "RETURNED_TO_DEV").length;
  const uniqueTesters = new Set(assignments.map(a => a.tester.id)).size;
  const busyTesters = new Set(assignments.filter(a => isActive(a.status)).map(a => a.tester.id)).size;
  const availableTesters = uniqueTesters - busyTesters;
  const completionRate = totalHU > 0 ? Math.round((prodHU / totalHU) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel de Asignaciones</h1>
          <p className="text-xs text-gray-400 mt-0.5">Resumen ejecutivo y gestion de recursos QA</p>
        </div>
        {can("assignments", "create") && (
          <Link href="/assignments/new" className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition-all shadow-sm uppercase tracking-wider inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nueva Asignacion
          </Link>
        )}
      </div>

      {/* ══════ RESUMEN GERENCIAL ══════ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-[#1F3864]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Resumen Ejecutivo</h2>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-6 gap-4 mb-5">
          <div className="text-center">
            <p className="font-mono text-3xl font-bold text-gray-900">{totalHU}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Total HU</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-bold text-blue-600">{activeHU}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">En Proceso</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-bold text-emerald-600">{prodHU}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Produccion</p>
          </div>
          <div className="text-center">
            <p className={`font-mono text-3xl font-bold ${returnedHU > 0 ? "text-red-600" : "text-gray-300"}`}>{returnedHU}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Devueltas</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-bold text-[#1F3864]">{busyTesters}<span className="text-gray-300">/{uniqueTesters}</span></p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Ocupados</p>
          </div>
          <div className="text-center">
            <p className={`font-mono text-3xl font-bold ${availableTesters > 0 ? "text-violet-600" : "text-gray-300"}`}>{availableTesters}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">Disponibles</p>
          </div>
        </div>

        {/* Pipeline visual - funnel de estados */}
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pipeline QA</p>
          <div className="flex items-center gap-1">
            {byStatus.map((s, idx) => {
              const pct = totalHU > 0 ? (s.count / totalHU) * 100 : 0;
              return (
                <div key={s.value} className="flex-1 group relative">
                  <div className="h-8 rounded flex items-center justify-center transition-all cursor-default"
                    style={{ backgroundColor: s.count > 0 ? s.color + "18" : "#f3f4f6", borderBottom: `3px solid ${s.count > 0 ? s.color : "#e5e7eb"}` }}>
                    <span className="font-mono text-xs font-bold" style={{ color: s.count > 0 ? s.color : "#d1d5db" }}>{s.count}</span>
                  </div>
                  <p className="text-[8px] text-gray-400 text-center mt-1 leading-tight">{s.short}</p>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                    {s.label}: {s.count} ({pct.toFixed(0)}%)
                  </div>
                  {idx < byStatus.length - 1 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-gray-300">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion bar */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">Tasa de Completitud</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
          </div>
          <span className="font-mono text-sm font-bold text-gray-700">{completionRate}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none">
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-lg p-0.5 overflow-x-auto">
          <button onClick={() => setFilterStatus("")} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition whitespace-nowrap ${!filterStatus ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>Todos</button>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition whitespace-nowrap inline-flex items-center gap-1 ${filterStatus === s.value ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.short}
            </button>
          ))}
        </div>
      </div>

      {/* Tester cards */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : groups.size === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Sin resultados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([testerId, group]) => {
            const activeCount = group.assignments.filter(a => isActive(a.status)).length;
            const prodCount = group.assignments.filter(a => a.status === "PRODUCTION").length;
            const hasReturned = group.assignments.some(a => a.status === "RETURNED_TO_DEV");
            const isFree = activeCount === 0;
            const nextEnd = group.assignments.filter(a => isActive(a.status) && a.endDate).sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0]?.endDate;
            const dLeft = nextEnd ? daysUntil(nextEnd) : null;

            return (
              <div key={testerId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm text-white ${isFree ? "bg-emerald-500" : hasReturned ? "bg-red-500" : "bg-[#1F3864]"}`}>
                    {group.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">{group.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${group.allocation === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {group.allocation}%
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${isFree ? "bg-emerald-100 text-emerald-700" : hasReturned ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {isFree ? "Disponible" : hasReturned ? "Bloqueado" : `${activeCount} activa${activeCount > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">{group.client} &middot; {group.project}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-center">
                    <div><p className="font-mono text-lg font-bold text-gray-900">{group.assignments.length}</p><p className="text-[8px] text-gray-400 uppercase">HU</p></div>
                    <div><p className="font-mono text-lg font-bold text-emerald-600">{prodCount}</p><p className="text-[8px] text-gray-400 uppercase">PRD</p></div>
                    {nextEnd && <div className="pl-4 border-l border-gray-200"><p className={`font-mono text-lg font-bold ${dLeft !== null && dLeft <= 3 ? "text-amber-500" : "text-gray-600"}`}>{dLeft !== null ? (dLeft <= 0 ? "Hoy" : `${dLeft}d`) : "—"}</p><p className="text-[8px] text-gray-400 uppercase">Libera</p></div>}
                  </div>
                </div>

                {/* Assignments */}
                <div className="divide-y divide-gray-50">
                  {group.assignments.sort((a, b) => (statusMap[a.status]?.step || 0) - (statusMap[b.status]?.step || 0)).map(a => {
                    const s = statusMap[a.status] || STATUSES[0];
                    const isProd = a.status === "PRODUCTION";

                    return (
                      <div key={a.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isProd ? "bg-gray-50/50" : "hover:bg-gray-50/50"}`}>
                        {/* Status dot + line */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${s.dot}`} />
                          <span className={`w-0.5 h-4 rounded-full ${isProd ? "bg-emerald-200" : "bg-gray-200"}`} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${isProd ? "text-gray-400" : "text-gray-800"}`}>{a.story.title}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${complexityBadge[a.story.executionComplexity] || ""}`}>
                              {a.story.executionComplexity === "HIGH" ? "Alta" : a.story.executionComplexity === "MEDIUM" ? "Media" : "Baja"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${s.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                            </span>
                            <span className="text-[10px] text-gray-400">{a.cycle?.name}</span>
                            <span className="text-[10px] text-gray-300 font-mono">{fmtDate(a.startDate)}{a.endDate ? ` → ${fmtDate(a.endDate)}` : ""}</span>
                          </div>
                          {a.notes && (
                            <div className="mt-1.5 inline-flex items-start gap-1 px-2 py-1 bg-amber-50 rounded border border-amber-100 max-w-md">
                              <svg className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              <p className="text-[10px] text-amber-700">{a.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Step indicator */}
                        <div className="shrink-0 flex items-center gap-0.5">
                          {STATUSES.map((st, idx) => (
                            <div key={st.value} className={`w-1.5 h-5 rounded-sm transition-all ${(statusMap[a.status]?.step || 0) >= st.step ? "" : "opacity-20"}`}
                              style={{ backgroundColor: (statusMap[a.status]?.step || 0) >= st.step ? s.color : "#e5e7eb" }}
                              title={st.label} />
                          ))}
                        </div>

                        {/* Next action */}
                        <div className="shrink-0 flex items-center gap-1">
                          {can("assignments", "update") && (
                            <Link href={`/assignments/${a.id}/edit`} className="px-2 py-1 text-[10px] text-gray-500 hover:text-[#2E5FA3] hover:bg-[#2E5FA3]/5 rounded transition font-medium">
                              Editar
                            </Link>
                          )}
                          {!isProd && can("assignments", "update") && (
                            <select value={a.status} onChange={e => changeStatus(a.id, e.target.value)}
                              className="px-2 py-1 text-[10px] border border-gray-200 rounded-md bg-white text-gray-600 focus:border-[#4A90D9] outline-none cursor-pointer hover:border-gray-300 transition">
                              {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                            </select>
                          )}
                          {isProd && (
                            <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
