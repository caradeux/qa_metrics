"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfDay, startOfWeek, addWeeks } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useHolidays } from "@/lib/holidays";
import { Modal } from "@/components/ui/Modal";
import { GanttChart, type GanttAssignment } from "@/components/gantt/GanttChart";

const STATUSES = [
  { value: "REGISTERED", label: "Inicio", short: "INI", color: "#6b7280" },
  { value: "ANALYSIS", label: "En Analisis", short: "ANA", color: "#8b5cf6" },
  { value: "TEST_DESIGN", label: "Diseno de Casos", short: "DIS", color: "#2E5FA3" },
  { value: "WAITING_QA_DEPLOY", label: "Esperando Ambientación QA", short: "AMB", color: "#ea580c" },
  { value: "EXECUTION", label: "En Ejecucion", short: "EJE", color: "#0891b2" },
  { value: "RETURNED_TO_DEV", label: "Devuelto a Dev", short: "DEV", color: "#ef4444" },
  { value: "WAITING_UAT", label: "Espera UAT", short: "ESP", color: "#f59e0b" },
  { value: "UAT", label: "En UAT", short: "UAT", color: "#d946ef" },
  { value: "PRODUCTION", label: "Produccion", short: "PRD", color: "#10b981" },
  { value: "ON_HOLD", label: "Detenido", short: "HOLD", color: "#64748b" },
] as const;

const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

interface Client { id: string; name: string }
interface Project { id: string; name: string; client?: { id: string; name: string } }
interface StoryOpt { id: string; title: string; externalId?: string | null; projectId: string }
interface TesterOpt {
  id: string;
  name: string;
  userId?: string | null;
  project: { id: string; name: string; client: { id: string; name: string } };
}
interface TesterGroup {
  key: string;            // userId o "name:X" si no tiene user
  name: string;
  testerIds: string[];    // todos los Tester.id que corresponden a esa persona
  projects: string[];
}
interface StatusLog { id: string; status: string; changedAt: string }

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function defaultRange() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return { from: monday, to: addDays(addWeeks(monday, 3), -1) };
}

export default function GanttPage() {
  const [assignments, setAssignments] = useState<GanttAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterTester, setFilterTester] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStories, setFilterStories] = useState<string[]>([]);
  const [storyOptions, setStoryOptions] = useState<StoryOpt[]>([]);
  const [storyDropdownOpen, setStoryDropdownOpen] = useState(false);
  const storyDropdownRef = useRef<HTMLDivElement>(null);
  const [testers, setTesters] = useState<TesterOpt[]>([]);
  const { from: defFrom, to: defTo } = useMemo(() => defaultRange(), []);
  const [dateFrom, setDateFrom] = useState<string>(isoDate(defFrom));
  const [dateTo, setDateTo] = useState<string>(isoDate(defTo));
  const [selected, setSelected] = useState<GanttAssignment | null>(null);
  const [history, setHistory] = useState<StatusLog[]>([]);

  const fromDate = useMemo(() => new Date(dateFrom), [dateFrom]);
  const toDate = useMemo(() => new Date(dateTo), [dateTo]);
  const years = useMemo(() => {
    const y1 = fromDate.getFullYear();
    const y2 = toDate.getFullYear();
    return y1 === y2 ? [y1] : [y1, y2];
  }, [fromDate, toDate]);

  const holidays1 = useHolidays(years[0]);
  const holidays2 = useHolidays(years[years.length - 1]);
  const holidays = useMemo(() => ({ ...holidays1, ...holidays2 }), [holidays1, holidays2]);

  const visibleProjects = useMemo(
    () => filterClient ? projects.filter(p => p.client?.id === filterClient) : projects,
    [filterClient, projects]
  );
  // Agrupa testers por persona (userId si existe, sino por nombre). Útil para saber cuándo
  // queda libre una persona que trabaja en múltiples proyectos.
  const testerGroups = useMemo<TesterGroup[]>(() => {
    const map = new Map<string, TesterGroup>();
    for (const t of testers) {
      if (filterClient && t.project.client.id !== filterClient) continue;
      if (filterProject && t.project.id !== filterProject) continue;
      const key = t.userId ? `u:${t.userId}` : `n:${t.name.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { key, name: t.name, testerIds: [], projects: [] });
      const g = map.get(key)!;
      g.testerIds.push(t.id);
      if (!g.projects.includes(t.project.name)) g.projects.push(t.project.name);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [testers, filterClient, filterProject]);

  const selectedTesterIds = useMemo<Set<string> | null>(() => {
    if (!filterTester) return null;
    const g = testerGroups.find((tg) => tg.key === filterTester);
    return g ? new Set(g.testerIds) : new Set();
  }, [filterTester, testerGroups]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterProject) params.set("projectId", filterProject);
    // Tester filter: se aplica client-side para soportar agrupado por persona (varios testerIds)
    if (filterStatus && filterStatus !== "__ACTIVE__") params.set("status", filterStatus);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      let data = await apiClient<GanttAssignment[]>(`/api/assignments?${params.toString()}`);
      if (filterClient && !filterProject) {
        const projectIds = new Set(visibleProjects.map(p => p.id));
        data = data.filter(a => projectIds.has(a.tester.project.id));
      }
      if (selectedTesterIds) {
        data = data.filter(a => selectedTesterIds.has(a.tester.id));
      }
      if (filterStatus === "__ACTIVE__") {
        const ACTIVE = new Set(["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION"]);
        data = data.filter(a => ACTIVE.has(a.status));
      }
      if (filterStories.length > 0) {
        const set = new Set(filterStories);
        data = data.filter(a => set.has(a.story.id));
      }
      setAssignments(data);
    } catch {
      setAssignments([]);
    }
    setLoading(false);
  }, [filterClient, filterProject, filterStatus, dateFrom, dateTo, visibleProjects, selectedTesterIds, filterStories]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    apiClient<Client[]>("/api/clients").then(setClients).catch(() => setClients([]));
    apiClient<Project[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
    apiClient<TesterOpt[]>("/api/testers").then(setTesters).catch(() => setTesters([]));
  }, []);

  useEffect(() => {
    if (filterProject && !visibleProjects.some(p => p.id === filterProject)) {
      setFilterProject("");
    }
  }, [filterProject, visibleProjects]);

  useEffect(() => {
    if (filterTester && !testerGroups.some(g => g.key === filterTester)) {
      setFilterTester("");
    }
  }, [filterTester, testerGroups]);

  // Carga de HUs por proyecto + reset del filtro si cambia el proyecto.
  useEffect(() => {
    setFilterStories([]);
    setStoryDropdownOpen(false);
    if (!filterProject) {
      setStoryOptions([]);
      return;
    }
    apiClient<StoryOpt[]>(`/api/stories?projectId=${filterProject}`)
      .then((rows) => setStoryOptions(rows))
      .catch(() => setStoryOptions([]));
  }, [filterProject]);

  // Cierra el dropdown al clickear fuera.
  useEffect(() => {
    if (!storyDropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (storyDropdownRef.current && !storyDropdownRef.current.contains(e.target as Node)) {
        setStoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [storyDropdownOpen]);

  const openDetail = async (a: GanttAssignment) => {
    setSelected(a);
    setHistory([]);
    try {
      const logs = await apiClient<StatusLog[]>(`/api/assignments/${a.id}/history`);
      setHistory(logs);
    } catch {}
  };

  const resetRange = () => {
    const { from, to } = defaultRange();
    setDateFrom(isoDate(from));
    setDateTo(isoDate(to));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planificacion Gantt</h1>
          <p className="text-xs text-gray-400 mt-0.5">Vista temporal de asignaciones por tester</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Cliente</label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none min-w-[180px]"
            >
              <option value="">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Proyecto</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none min-w-[180px]"
            >
              <option value="">{filterClient ? "Todos del cliente" : "Todos"}</option>
              {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tester</label>
            <select
              value={filterTester}
              onChange={(e) => setFilterTester(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none min-w-[180px]"
            >
              <option value="">Todos</option>
              {testerGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                  {g.projects.length > 1 ? ` (${g.projects.length} proyectos)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none min-w-[160px]"
            >
              <option value="">Todos</option>
              <option value="__ACTIVE__">⚡ Solo activos (en trabajo)</option>
              <option disabled value="__SEP__">──────────</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div ref={storyDropdownRef} className="relative">
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">HU</label>
            <button
              type="button"
              onClick={() => filterProject && setStoryDropdownOpen((v) => !v)}
              disabled={!filterProject}
              className={`px-3 py-1.5 bg-white border rounded-lg text-xs outline-none min-w-[200px] text-left flex items-center justify-between gap-2 ${
                filterProject
                  ? "border-gray-200 focus:border-[#4A90D9] hover:border-gray-300"
                  : "border-gray-100 text-gray-400 cursor-not-allowed"
              } ${filterStories.length > 0 ? "border-[#4A90D9] text-[#1F3864] font-medium" : ""}`}
            >
              <span className="truncate">
                {!filterProject
                  ? "Selecciona un proyecto"
                  : filterStories.length === 0
                  ? "Todas"
                  : filterStories.length === 1
                  ? (() => {
                      const s = storyOptions.find((o) => o.id === filterStories[0]);
                      return s ? `${s.externalId ? s.externalId + " — " : ""}${s.title}` : "1 HU";
                    })()
                  : `${filterStories.length} HUs seleccionadas`}
              </span>
              <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {storyDropdownOpen && filterProject && (
              <div className="absolute left-0 top-full z-30 mt-1 w-[320px] max-h-[320px] overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setFilterStories([])}
                    className="text-[11px] font-semibold text-[#1F3864] hover:underline"
                  >
                    Limpiar (ver todas)
                  </button>
                  <span className="text-[10px] text-gray-400">
                    {filterStories.length}/{storyOptions.length}
                  </span>
                </div>
                {storyOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-400">
                    El proyecto no tiene HUs.
                  </div>
                ) : (
                  storyOptions.map((s) => {
                    const checked = filterStories.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-xs hover:bg-[#1F3864]/5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFilterStories((prev) =>
                              prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                            );
                          }}
                          className="mt-0.5 shrink-0 accent-[#1F3864]"
                        />
                        <span className="min-w-0 flex-1">
                          {s.externalId && (
                            <span className="font-mono text-gray-500">{s.externalId}</span>
                          )}
                          {s.externalId && <span className="text-gray-300"> — </span>}
                          <span className="text-gray-800">{s.title}</span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none"
            />
          </div>
          <button
            onClick={resetRange}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition-all shadow-sm uppercase tracking-wider"
          >
            Hoy
          </button>
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
          {STATUSES.map((s) => (
            <span key={s.value} className="inline-flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 relative">
              <span className="absolute top-0 right-0 text-[7px] font-bold text-amber-700 leading-none">F</span>
            </span>
            Feriado CL
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
            Fin de semana
          </span>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <GanttChart
          assignments={assignments}
          dateFrom={fromDate}
          dateTo={toDate}
          statuses={STATUSES}
          holidays={holidays}
          onBarClick={openDetail}
        />
      )}

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalle de asignacion"
        maxWidth="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Historia de Usuario</p>
              <p className="text-sm font-semibold text-gray-900">{selected.story.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tester</p>
                <p className="text-sm text-gray-800">{selected.tester.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Proyecto</p>
                <p className="text-sm text-gray-800">{selected.tester.project.client.name} · {selected.tester.project.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Ciclo</p>
                <p className="text-sm text-gray-800">{selected.cycle?.name || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Estado</p>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: statusMap[selected.status]?.color || "#6b7280" }}
                >
                  {statusMap[selected.status]?.label || selected.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Complejidad Diseno</p>
                <p className="text-sm text-gray-800">{selected.story.designComplexity}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Complejidad Ejecucion</p>
                <p className="text-sm text-gray-800">{selected.story.executionComplexity}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Inicio</p>
                <p className="text-sm text-gray-800">{format(new Date(selected.startDate), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Fin</p>
                <p className="text-sm text-gray-800">{selected.endDate ? format(new Date(selected.endDate), "dd/MM/yyyy") : "En curso"}</p>
              </div>
            </div>
            {selected.notes && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Notas</p>
                <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded p-2">{selected.notes}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Historial de estados</p>
              {history.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin historial</p>
              ) : (
                <ul className="space-y-1">
                  {history.map((log) => (
                    <li key={log.id} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: statusMap[log.status]?.color || "#6b7280" }}
                      />
                      <span className="text-gray-700 font-medium">
                        {statusMap[log.status]?.label || log.status}
                      </span>
                      <span className="text-gray-400 font-mono text-[10px]">
                        {format(new Date(log.changedAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
