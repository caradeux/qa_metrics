"use client";

import { useEffect, useMemo, useState } from "react";
import {
  occupationApi,
  activitiesApi,
  type OccupationRow,
  type Activity,
  apiClient,
} from "@/lib/api-client";
import { OccupationChart } from "@/components/activities/OccupationChart";
import { CategoryDonut } from "@/components/activities/CategoryDonut";
import { OccupationBarHorizontal } from "@/components/activities/OccupationBarHorizontal";
import { OccupationTable } from "@/components/activities/OccupationTable";
import { StoryActivityBreakdown } from "@/components/activities/StoryActivityBreakdown";
import { ActivityList } from "@/components/activities/ActivityList";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { usePermissions } from "@/hooks/usePermissions";

interface TesterOption {
  id: string;
  name: string;
  projectId: string;
  project?: { id: string; name: string } | null;
}
interface ClientOption {
  id: string;
  name: string;
}
interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
  client?: { id: string; name: string } | null;
}
interface StoryOption {
  id: string;
  externalId: string | null;
  title: string;
  projectId: string;
}
interface StoryDetail {
  id: string;
  cycles: Array<{
    assignments: Array<{ tester: { id: string; name: string } }>;
  }>;
  currentAssignment: { tester: { id: string; name: string } } | null;
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}

function KPICard({
  title,
  value,
  suffix,
  subtitle,
  accent,
  icon,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  subtitle?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div
        className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full opacity-10"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
          <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: accent }}>
            {value}
            {suffix ?? ""}
          </p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

const KPI_ICONS = {
  capacity: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  activity: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 12a3 3 0 100-6 3 3 0 000 6zm10 0a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  gauge: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  warn: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

export default function OccupationReportPage() {
  const [allTesters, setAllTesters] = useState<TesterOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [stories, setStories] = useState<StoryOption[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [storyId, setStoryId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [{ from, to }, setRange] = useState(weekRange());
  const [rows, setRows] = useState<OccupationRow[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<{ tester: OccupationRow; activities: Activity[]; testerIds: string[] } | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formTesterId, setFormTesterId] = useState<string | null>(null);
  const { can } = usePermissions();
  const canEditActivities = can("activities", "update");
  const canDeleteActivities = can("activities", "delete");

  // Carga inicial de clientes + proyectos + testers
  useEffect(() => {
    apiClient<TesterOption[]>("/api/testers").then((list) => {
      setAllTesters(list);
      setSelected(list.map((t) => t.id));
    });
    apiClient<ClientOption[]>("/api/clients").then(setClients);
    apiClient<ProjectOption[]>("/api/projects").then(setProjects);
  }, []);

  // Proyectos visibles según cliente
  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((p) => (p.clientId ?? p.client?.id) === clientId);
  }, [projects, clientId]);

  // Si el proyecto seleccionado ya no calza con el cliente elegido, limpiarlo
  useEffect(() => {
    if (projectId && !filteredProjects.some((p) => p.id === projectId)) {
      setProjectId("");
    }
  }, [filteredProjects, projectId]);

  // Cuando cambia proyecto, recargar HUs y resetear story
  useEffect(() => {
    setStoryId("");
    if (!projectId) {
      setStories([]);
      return;
    }
    apiClient<StoryOption[]>(`/api/stories?projectId=${projectId}`).then(setStories);
  }, [projectId]);

  // Scope de testers según filtros cliente/proyecto/HU
  const filteredTesters = useMemo(() => {
    let list = allTesters;
    if (projectId) list = list.filter((t) => t.projectId === projectId);
    else if (clientId) {
      const projIds = new Set(filteredProjects.map((p) => p.id));
      list = list.filter((t) => projIds.has(t.projectId));
    }
    return list;
  }, [allTesters, projectId, clientId, filteredProjects]);

  // Agrupa las filas de Tester por persona (nombre). Una persona puede tener
  // varios Tester rows (uno por proyecto); en el filtro debe aparecer una sola
  // vez, y al seleccionarla se incluyen todos sus testerIds.
  const filteredPersons = useMemo(() => {
    const byName = new Map<string, { name: string; testerIds: string[] }>();
    for (const t of filteredTesters) {
      const entry = byName.get(t.name);
      if (entry) entry.testerIds.push(t.id);
      else byName.set(t.name, { name: t.name, testerIds: [t.id] });
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [filteredTesters]);

  // Derivado: nombres seleccionados a partir de testerIds marcados.
  const selectedPersonNames = useMemo(() => {
    const sel = new Set(selected);
    return filteredPersons.filter((p) => p.testerIds.some((id) => sel.has(id))).map((p) => p.name);
  }, [filteredPersons, selected]);

  // Cuando cambia HU, resolver sus testers y ajustar selección
  useEffect(() => {
    if (!storyId) {
      setSelected(filteredTesters.map((t) => t.id));
      return;
    }
    apiClient<StoryDetail>(`/api/stories/${storyId}`).then((st) => {
      const ids = new Set<string>();
      if (st.currentAssignment?.tester?.id) ids.add(st.currentAssignment.tester.id);
      for (const c of st.cycles ?? []) {
        for (const a of c.assignments ?? []) {
          if (a.tester?.id) ids.add(a.tester.id);
        }
      }
      const matching = filteredTesters.filter((t) => ids.has(t.id));
      setSelected(matching.map((t) => t.id));
    });
  }, [storyId, filteredTesters]);

  // Re-sincroniza selección si cambia proyecto (y no hay story)
  useEffect(() => {
    if (!storyId) setSelected(filteredTesters.map((t) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch de ocupación + actividades (en paralelo)
  useEffect(() => {
    if (selected.length === 0) {
      setRows([]);
      setAllActivities([]);
      return;
    }
    setLoading(true);
    const toIso = `${to}T23:59:59.999Z`;
    const occPromise = occupationApi.get({ testerIds: selected, from, to: toIso });
    const actsPromise = Promise.all(
      selected.map((tid) =>
        activitiesApi.list({ testerId: tid, from, to: toIso }).catch(() => [] as Activity[]),
      ),
    ).then((arr) => arr.flat());
    Promise.all([occPromise, actsPromise])
      .then(([occ, acts]) => {
        setRows(occ);
        // Si hay filtro de HU, recortamos actividades a esa HU
        const filtered = storyId
          ? acts.filter((a) => a.assignment?.story.id === storyId)
          : acts;
        setAllActivities(filtered);
      })
      .finally(() => setLoading(false));
  }, [selected, from, to, storyId]);

  // Deduplicación por persona (testerName): si Juan es tester en 2 proyectos,
  // suma su capacidad/actividad y recalcula ocupación para mostrar una sola fila.
  const dedupedRows = useMemo(() => {
    const byName = new Map<string, OccupationRow & { testerIds: string[] }>();
    for (const r of rows) {
      const existing = byName.get(r.testerName);
      if (!existing) {
        byName.set(r.testerName, { ...r, testerIds: [r.testerId] });
        continue;
      }
      existing.testerIds.push(r.testerId);
      existing.capacityHours += r.capacityHours;
      existing.activityHours += r.activityHours;
      existing.productiveHoursEstimate += r.productiveHoursEstimate;
      existing.workdays = Math.max(existing.workdays, r.workdays);
      existing.periodDays = Math.max(existing.periodDays, r.periodDays);
      for (const cat of r.byCategory) {
        const e = existing.byCategory.find((c) => c.name === cat.name);
        if (e) e.hours += cat.hours;
        else existing.byCategory.push({ ...cat });
      }
      for (const asg of r.byAssignment) {
        const e = existing.byAssignment.find((a) => a.assignmentId === asg.assignmentId);
        if (e) e.hours += asg.hours;
        else existing.byAssignment.push({ ...asg });
      }
    }
    for (const agg of byName.values()) {
      agg.occupationPct =
        agg.capacityHours > 0
          ? Math.min(100, ((agg.activityHours + agg.productiveHoursEstimate) / agg.capacityHours) * 100)
          : 0;
      agg.overallocated = agg.activityHours > agg.capacityHours;
    }
    return [...byName.values()];
  }, [rows]);

  // KPIs sobre rows deduplicadas
  const kpis = useMemo(() => {
    if (dedupedRows.length === 0)
      return { capacity: 0, activity: 0, avgOccupation: 0, overallocated: 0 };
    const capacity = dedupedRows.reduce((s, r) => s + r.capacityHours, 0);
    const activity = dedupedRows.reduce((s, r) => s + r.activityHours, 0);
    const avgOccupation = dedupedRows.reduce((s, r) => s + r.occupationPct, 0) / dedupedRows.length;
    const overallocated = dedupedRows.filter((r) => r.overallocated).length;
    return { capacity, activity, avgOccupation, overallocated };
  }, [dedupedRows]);

  // Label de tester con proyecto para desambiguar
  function testerLabel(t: TesterOption) {
    const p = projects.find((p) => p.id === t.projectId);
    return p ? `${t.name} — ${p.name}` : t.name;
  }

  async function openDrill(row: OccupationRow & { testerIds?: string[] }) {
    const ids = row.testerIds && row.testerIds.length > 0 ? row.testerIds : [row.testerId];
    const toIso = `${to}T23:59:59.999Z`;
    const lists = await Promise.all(
      ids.map((tid) => activitiesApi.list({ testerId: tid, from, to: toIso })),
    );
    setDrill({ tester: row, activities: lists.flat(), testerIds: ids });
  }

  async function refreshDrillActivities() {
    if (!drill) return;
    const toIso = `${to}T23:59:59.999Z`;
    const lists = await Promise.all(
      drill.testerIds.map((tid) => activitiesApi.list({ testerId: tid, from, to: toIso })),
    );
    setDrill({ ...drill, activities: lists.flat() });
  }

  async function handleDeleteActivity(a: Activity) {
    if (!confirm(`¿Eliminar esta actividad (${a.category.name})?`)) return;
    try {
      await activitiesApi.remove(a.id);
      await refreshDrillActivities();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo eliminar");
    }
  }

  function handleEditActivity(a: Activity) {
    setFormTesterId(a.testerId);
    setEditingActivity(a);
  }

  const rangeLabel = `${from} a ${to}`;

  return (
    <div className="p-6">
      {/* HEADER gradiente */}
      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Reporte</p>
              <h1 className="text-3xl font-bold tracking-tight">Ocupación de Testers</h1>
              <p className="text-sm text-white/70">Distribución de horas por categoría · {rangeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Filtros</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange({ from: e.target.value, to })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange({ from, to: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cliente</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              <option value="">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Proyecto</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              <option value="">Todos</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {!clientId && p.client?.name ? `${p.client.name} · ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Historia (HU)</span>
            <select
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              disabled={!projectId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {projectId ? "Todas las HU" : "Seleccione un proyecto"}
              </option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.externalId ? `${s.externalId} — ` : ""}
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Testers ({selectedPersonNames.length}/{filteredPersons.length})
            </span>
            <select
              multiple
              value={selectedPersonNames}
              onChange={(e) => {
                const chosen = new Set(Array.from(e.target.selectedOptions).map((o) => o.value));
                const next = filteredPersons
                  .filter((p) => chosen.has(p.name))
                  .flatMap((p) => p.testerIds);
                setSelected(next);
              }}
              className="mt-1 block h-[84px] w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            >
              {filteredPersons.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.testerIds.length > 1 ? ` (${p.testerIds.length} proyectos)` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          title="Capacidad total"
          value={kpis.capacity.toFixed(1)}
          suffix="h"
          subtitle="Días hábiles × 8h × allocation%"
          accent="#1F3864"
          icon={KPI_ICONS.capacity}
        />
        <KPICard
          title="Horas actividad"
          value={kpis.activity.toFixed(1)}
          suffix="h"
          subtitle="Reuniones, capacitaciones, etc."
          accent="#7c3aed"
          icon={KPI_ICONS.activity}
        />
        <KPICard
          title="Ocupación promedio"
          value={Math.round(kpis.avgOccupation)}
          suffix="%"
          subtitle="(Actividad + Productivo) / Capacidad"
          accent="#0891b2"
          icon={KPI_ICONS.gauge}
        />
        <KPICard
          title="Sobrecarga"
          value={kpis.overallocated}
          subtitle={kpis.overallocated === 1 ? "Tester >100%" : "Testers >100%"}
          accent={kpis.overallocated > 0 ? "#dc2626" : "#16a34a"}
          icon={KPI_ICONS.warn}
        />
      </div>

      {loading && (
        <div className="mb-4 text-xs text-gray-400">Cargando…</div>
      )}

      {/* CHARTS */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <OccupationChart rows={dedupedRows} />
        </div>
        <div className="lg:col-span-2">
          <OccupationBarHorizontal rows={dedupedRows} />
        </div>
        <div className="lg:col-span-1">
          <CategoryDonut rows={dedupedRows} />
        </div>
      </div>

      {/* Horas por HU - vista tabular */}
      <div className="mb-6">
        <StoryActivityBreakdown activities={allActivities} />
      </div>

      {/* TABLA */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
          <span className="mr-2 inline-block h-[2px] w-6 align-middle bg-[#1F3864]" />
          Detalle por tester
        </h2>
        <OccupationTable rows={dedupedRows} onSelect={openDrill} />
      </section>

      {/* DRILL-DOWN modal */}
      {drill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDrill(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h2 className="text-base font-semibold">{drill.tester.testerName}</h2>
                <span className="ml-auto text-xs text-white/70">Actividades {from} a {to}</span>
              </div>
            </div>
            <div className="p-6">
              <ActivityList
                activities={drill.activities}
                onEdit={canEditActivities ? handleEditActivity : undefined}
                onDelete={canDeleteActivities ? handleDeleteActivity : undefined}
              />
              <div className="mt-5 text-right">
                <button
                  onClick={() => setDrill(null)}
                  className="rounded-md border border-gray-300 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600 transition hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingActivity && formTesterId && (
        <ActivityForm
          testerId={formTesterId}
          initial={editingActivity}
          onClose={() => {
            setEditingActivity(null);
            setFormTesterId(null);
          }}
          onSaved={async () => {
            setEditingActivity(null);
            setFormTesterId(null);
            await refreshDrillActivities();
          }}
        />
      )}
    </div>
  );
}
