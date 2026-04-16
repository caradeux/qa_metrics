"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

type EntityType = "CYCLE" | "ASSIGNMENT" | "PHASE";

interface LogItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  entityDescription: string;
  projectId: string | null;
}

interface LogResponse {
  items: LogItem[];
  count: number;
  limit: number;
  offset: number;
}

const ENTITY_LABEL: Record<EntityType, string> = {
  CYCLE: "Ciclo",
  ASSIGNMENT: "Asignación",
  PHASE: "Fase",
};

const ENTITY_COLOR: Record<EntityType, string> = {
  CYCLE: "#2E5FA3",
  ASSIGNMENT: "#0891b2",
  PHASE: "#8b5cf6",
};

const FIELD_LABEL: Record<string, string> = {
  startDate: "Fecha inicio",
  endDate: "Fecha fin",
};

function formatDateValue(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimestamp(v: string): string {
  const d = new Date(v);
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function groupByDay(items: LogItem[]): { day: string; entries: LogItem[] }[] {
  const groups = new Map<string, LogItem[]>();
  for (const item of items) {
    const day = new Date(item.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return Array.from(groups.entries()).map(([day, entries]) => ({ day, entries }));
}

interface ProjectLite { id: string; name: string; client?: { name: string } }
interface StoryLite { id: string; title: string; externalId?: string | null }

export default function AuditPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [entityType, setEntityType] = useState<"" | EntityType>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [storyId, setStoryId] = useState("");

  // Listas para selectores dependientes
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [stories, setStories] = useState<StoryLite[]>([]);

  async function fetchLogs() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (projectId) params.set("projectId", projectId);
      if (storyId) params.set("storyId", storyId);
      params.set("limit", "200");
      const data = await apiClient<LogResponse>(`/api/date-change-logs?${params.toString()}`);
      setLogs(data.items);
    } catch (err: any) {
      setError(err?.message || "Error al cargar bitácora");
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial: logs + proyectos
  useEffect(() => {
    void fetchLogs();
    apiClient<ProjectLite[]>("/api/projects")
      .then((list) => setProjects(list))
      .catch(() => setProjects([]));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Cargar HUs cuando cambia el proyecto
  useEffect(() => {
    setStoryId("");
    if (!projectId) { setStories([]); return; }
    apiClient<StoryLite[]>(`/api/stories?projectId=${projectId}`)
      .then((list) => setStories(list))
      .catch(() => setStories([]));
  }, [projectId]);

  const groups = useMemo(() => groupByDay(logs), [logs]);

  const inp = "px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Auditoría de fechas</h1>
      <p className="text-sm text-muted mb-6">
        Registro cronológico de cambios de fechas en ciclos, asignaciones y fases. Cada entrada conserva el valor anterior, el nuevo, el motivo y la persona que realizó el cambio.
      </p>

      {/* Filtros */}
      <div className="bg-card p-4 rounded-xl border border-border mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Proyecto</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inp} style={{ minWidth: 200 }}>
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.client?.name ? `${p.client.name} · ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Historia de Usuario</label>
          <select
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
            disabled={!projectId}
            className={`${inp} disabled:bg-gray-50 disabled:text-gray-400`}
            style={{ minWidth: 240 }}
          >
            <option value="">{projectId ? "Todas" : "Selecciona un proyecto primero"}</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.externalId ? `${s.externalId} · ` : ""}{s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value as any)} className={inp}>
            <option value="">Todos</option>
            <option value="CYCLE">Ciclo</option>
            <option value="ASSIGNMENT">Asignación</option>
            <option value="PHASE">Fase</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inp} />
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={() => {
            setEntityType(""); setDateFrom(""); setDateTo("");
            setProjectId(""); setStoryId("");
            setTimeout(fetchLogs, 0);
          }}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          Limpiar
        </button>
        <div className="ml-auto text-xs text-gray-500">
          {loading ? "Cargando..." : `${logs.length} registro(s)`}
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {/* Timeline */}
      {!loading && logs.length === 0 && (
        <div className="bg-card p-8 rounded-xl border border-border text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500">No hay cambios de fechas en el rango seleccionado.</p>
        </div>
      )}

      <div className="relative">
        {/* Línea vertical del timeline */}
        {groups.length > 0 && (
          <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gray-200" />
        )}

        {groups.map(({ day, entries }) => (
          <div key={day} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm relative z-10" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{day}</h2>
            </div>
            <div className="ml-8 space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white rounded"
                        style={{ background: ENTITY_COLOR[entry.entityType] }}
                      >
                        {ENTITY_LABEL[entry.entityType]}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{entry.entityDescription}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {formatTimestamp(entry.createdAt)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">{FIELD_LABEL[entry.field] ?? entry.field}:</span>{" "}
                    <span className="line-through text-gray-400">{formatDateValue(entry.oldValue)}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="font-semibold text-foreground">{formatDateValue(entry.newValue)}</span>
                  </div>

                  <div className="bg-amber-50 border-l-4 border-amber-300 px-3 py-2 rounded-r">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">Motivo:</span> {entry.reason}
                    </p>
                  </div>

                  <div className="mt-2 text-[11px] text-gray-500">
                    Registrado por <span className="font-medium text-gray-700">{entry.user.name}</span>
                    {entry.user.email ? <span className="text-gray-400"> · {entry.user.email}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
