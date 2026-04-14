"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
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
] as const;

const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

interface Client { id: string; name: string }
interface Project { id: string; name: string; client?: { id: string; name: string } }
interface StatusLog { id: string; status: string; changedAt: string }

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function defaultRange() {
  const today = startOfDay(new Date());
  return { from: addDays(today, -30), to: addDays(today, 60) };
}

export default function GanttPage() {
  const [assignments, setAssignments] = useState<GanttAssignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
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

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterProject) params.set("projectId", filterProject);
    if (filterStatus) params.set("status", filterStatus);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      let data = await apiClient<GanttAssignment[]>(`/api/assignments?${params.toString()}`);
      if (filterClient && !filterProject) {
        const projectIds = new Set(visibleProjects.map(p => p.id));
        data = data.filter(a => projectIds.has(a.tester.project.id));
      }
      setAssignments(data);
    } catch {
      setAssignments([]);
    }
    setLoading(false);
  }, [filterClient, filterProject, filterStatus, dateFrom, dateTo, visibleProjects]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    apiClient<Client[]>("/api/clients").then(setClients).catch(() => setClients([]));
    apiClient<Project[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (filterProject && !visibleProjects.some(p => p.id === filterProject)) {
      setFilterProject("");
    }
  }, [filterProject, visibleProjects]);

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
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none min-w-[160px]"
            >
              <option value="">Todos</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
