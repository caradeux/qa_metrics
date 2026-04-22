"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STATUSES, statusMap, ComplexityBadge } from "@/components/stories/StatusBadge";

interface TesterLite { id: string; name: string }
interface AssignmentPhase {
  id: string;
  phase: "ANALYSIS" | "TEST_DESIGN" | "EXECUTION";
  startDate: string;
  endDate: string;
}
interface CycleAssignment {
  id: string;
  tester: TesterLite | null;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  daysInStatus: number | null;
  phases?: AssignmentPhase[];
}
interface StoryCycle {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  assignments: CycleAssignment[];
}
interface Story {
  id: string;
  externalId: string | null;
  title: string;
  designComplexity: string;
  executionComplexity: string;
  projectId: string;
  assignmentsCount: number;
  cycles: StoryCycle[];
}
interface StoriesResponse { projectId: string; stories: Story[] }
interface ProjectDetail { id: string; name: string; client: { name: string } }

const COMPLEXITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const complexityLabels: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };

const PHASE_LABEL: Record<string, string> = { ANALYSIS: "Análisis", TEST_DESIGN: "Diseño", EXECUTION: "Ejecución" };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return Math.max(0, Math.floor((e - s) / 86400000) + 1);
}

function buildEstimationText(story: Story, projectName: string, clientName: string): string {
  const lines: string[] = [];
  lines.push(`HU: ${story.externalId ? `#${story.externalId} - ` : ""}${story.title}`);
  lines.push(`Cliente: ${clientName}`);
  lines.push(`Proyecto: ${projectName}`);
  lines.push(`Complejidad diseño: ${complexityLabels[story.designComplexity] ?? story.designComplexity}`);
  lines.push(`Complejidad ejecución: ${complexityLabels[story.executionComplexity] ?? story.executionComplexity}`);
  lines.push("");

  if (story.cycles.length === 0) {
    lines.push("Sin ciclos definidos.");
    return lines.join("\n");
  }

  for (const cycle of story.cycles) {
    const rango = cycle.startDate ? ` (${fmtDate(cycle.startDate)} - ${fmtDate(cycle.endDate)})` : "";
    lines.push(`${cycle.name}${rango}`);
    if (cycle.assignments.length === 0) {
      lines.push("  Sin asignaciones.");
      lines.push("");
      continue;
    }
    for (const a of cycle.assignments) {
      const testerName = a.tester?.name ?? "Sin asignar";
      const endForCalc = a.endDate ?? new Date().toISOString();
      const dur = daysBetween(a.startDate, endForCalc);
      lines.push(`  Tester: ${testerName}`);
      lines.push(`  Rango: ${fmtDate(a.startDate)} → ${fmtDate(a.endDate)} (${dur} día${dur === 1 ? "" : "s"})`);
      if (a.phases && a.phases.length > 0) {
        lines.push(`  Fases:`);
        const order: Record<string, number> = { ANALYSIS: 1, TEST_DESIGN: 2, EXECUTION: 3 };
        const sorted = [...a.phases].sort((x, y) => (order[x.phase] ?? 9) - (order[y.phase] ?? 9));
        for (const p of sorted) {
          const pDur = daysBetween(p.startDate, p.endDate);
          lines.push(`    - ${PHASE_LABEL[p.phase] ?? p.phase}: ${fmtDate(p.startDate)} → ${fmtDate(p.endDate)} (${pDur} día${pDur === 1 ? "" : "s"})`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export default function ProjectStoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { can } = usePermissions();
  const [data, setData] = useState<StoriesResponse | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [testers, setTesters] = useState<TesterLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [testerFilter, setTesterFilter] = useState<string>("ALL");
  const [complexityFilter, setComplexityFilter] = useState<string>("ALL");

  // Modals
  const [editStory, setEditStory] = useState<Story | null>(null);
  const [newStoryOpen, setNewStoryOpen] = useState(false);
  const [newCycleForStory, setNewCycleForStory] = useState<Story | null>(null);
  const [assignToCycle, setAssignToCycle] = useState<{ story: Story; cycle: StoryCycle; isFirstCycle: boolean } | null>(null);
  const [editPhases, setEditPhases] = useState<{ assignmentId: string; phases: AssignmentPhase[] } | null>(null);
  const [deleteStoryTarget, setDeleteStoryTarget] = useState<Story | null>(null);
  const [deleteCycleTarget, setDeleteCycleTarget] = useState<{ id: string; name: string; assignmentCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient<StoriesResponse>(`/api/projects/${projectId}/stories`);
      setData(res);
    } catch {
      setData({ projectId, stories: [] });
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    apiClient<ProjectDetail>(`/api/projects/${projectId}`).then(setProject).catch(() => setProject(null));
    apiClient<TesterLite[]>(`/api/testers?projectId=${projectId}`).then(setTesters).catch(() => setTesters([]));
  }, [projectId]);

  const allStories = data?.stories ?? [];
  const hasAnyFilter = query.trim() !== "" || statusFilter !== "ALL" || testerFilter !== "ALL" || complexityFilter !== "ALL";

  const visibleStories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allStories.filter((s) => {
      if (q) {
        const inTitle = s.title.toLowerCase().includes(q);
        const inExternal = (s.externalId ?? "").toLowerCase().includes(q);
        if (!inTitle && !inExternal) return false;
      }
      if (statusFilter !== "ALL") {
        const has = s.cycles.some((c) => c.assignments.some((a) => a.status === statusFilter));
        if (!has) return false;
      }
      if (testerFilter !== "ALL") {
        const has = s.cycles.some((c) => c.assignments.some((a) => a.tester?.id === testerFilter));
        if (!has) return false;
      }
      if (complexityFilter !== "ALL") {
        if (s.designComplexity !== complexityFilter && s.executionComplexity !== complexityFilter) {
          return false;
        }
      }
      return true;
    });
  }, [allStories, query, statusFilter, testerFilter, complexityFilter]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setTesterFilter("ALL");
    setComplexityFilter("ALL");
  }

  async function changeStatus(assignmentId: string, status: string) {
    const body: Record<string, unknown> = { status };
    if (status === "PRODUCTION") body.endDate = new Date().toISOString().split("T")[0];
    try {
      await apiClient(`/api/assignments/${assignmentId}`, { method: "PUT", body: JSON.stringify(body) });
      fetchData();
    } catch (e) { console.error(e); }
  }

  async function confirmDeleteStory() {
    if (!deleteStoryTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/stories/${deleteStoryTarget.id}`, { method: "DELETE" });
      setDeleteStoryTarget(null);
      fetchData();
    } catch (e: any) {
      alert(e?.message || "No se pudo eliminar la HU");
    } finally { setDeleting(false); }
  }

  async function confirmDeleteCycle() {
    if (!deleteCycleTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/api/cycles/${deleteCycleTarget.id}`, { method: "DELETE" });
      setDeleteCycleTarget(null);
      fetchData();
    } catch (e: any) {
      alert(e?.message || "No se pudo eliminar el ciclo");
    } finally { setDeleting(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/projects" className="hover:text-[#2E5FA3]">Proyectos</Link>
            <span>/</span>
            <span>HUs</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{project?.name || "Cargando..."}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{project?.client?.name} - Historias de Usuario</p>
        </div>
        {can("stories", "create") && (
          <button onClick={() => setNewStoryOpen(true)} className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition-all shadow-sm uppercase tracking-wider inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nueva HU
          </button>
        )}
      </div>

      {/* Filter bar — only when there are stories to filter */}
      {!loading && data && data.stories.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.4a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título o ID…"
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-gray-200 bg-white focus:border-[#2E5FA3] focus:outline-none placeholder:text-gray-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-gray-200 bg-white focus:border-[#2E5FA3] focus:outline-none"
          >
            <option value="ALL">Estado: todos</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={testerFilter}
            onChange={(e) => setTesterFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-gray-200 bg-white focus:border-[#2E5FA3] focus:outline-none"
          >
            <option value="ALL">Tester: todos</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={complexityFilter}
            onChange={(e) => setComplexityFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-gray-200 bg-white focus:border-[#2E5FA3] focus:outline-none"
          >
            <option value="ALL">Complejidad: todas</option>
            {COMPLEXITIES.map((c) => (
              <option key={c} value={c}>
                {complexityLabels[c]}
              </option>
            ))}
          </select>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 px-3 text-[11px] font-medium rounded-md text-gray-600 hover:bg-gray-100 transition"
            >
              Limpiar
            </button>
          )}
          <div className="ml-auto text-[11px] text-gray-400 tabular-nums">
            {visibleStories.length} de {allStories.length} HU{allStories.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : !data || data.stories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">No hay historias de usuario aun.</p>
        </div>
      ) : visibleStories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">Ninguna HU coincide con los filtros.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-xs text-[#2E5FA3] hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleStories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              projectName={project?.name ?? ""}
              clientName={project?.client?.name ?? ""}
              canUpdate={can("stories", "update")}
              canDelete={can("stories", "delete")}
              canCreateCycle={can("cycles", "create")}
              canAssign={can("assignments", "create")}
              canChangeStatus={can("assignments", "update")}
              onEdit={() => setEditStory(story)}
              onDelete={() => setDeleteStoryTarget(story)}
              canDeleteCycle={can("cycles", "delete")}
              onNewCycle={() => setNewCycleForStory(story)}
              onDeleteCycle={(cycleId, cycleName, count) => setDeleteCycleTarget({ id: cycleId, name: cycleName, assignmentCount: count })}
              onAssignToCycle={(cycle, isFirstCycle) => setAssignToCycle({ story, cycle, isFirstCycle })}
              onChangeStatus={changeStatus}
              onEditPhases={(assignmentId, phases) => setEditPhases({ assignmentId, phases })}
            />
          ))}
        </div>
      )}

      <StoryFormModal
        open={newStoryOpen}
        onClose={() => setNewStoryOpen(false)}
        projectId={projectId}
        onSaved={() => { setNewStoryOpen(false); fetchData(); }}
      />
      <StoryFormModal
        open={!!editStory}
        story={editStory ?? undefined}
        onClose={() => setEditStory(null)}
        projectId={projectId}
        onSaved={() => { setEditStory(null); fetchData(); }}
      />
      <CycleFormModal
        open={!!newCycleForStory}
        story={newCycleForStory ?? undefined}
        onClose={() => setNewCycleForStory(null)}
        onSaved={() => { setNewCycleForStory(null); fetchData(); }}
      />
      <AssignToCycleModal
        open={!!assignToCycle}
        entry={assignToCycle ?? undefined}
        testers={testers}
        onClose={() => setAssignToCycle(null)}
        onSaved={() => { setAssignToCycle(null); fetchData(); }}
      />
      <EditPhasesModal
        open={!!editPhases}
        assignmentId={editPhases?.assignmentId}
        initialPhases={editPhases?.phases ?? []}
        onClose={() => setEditPhases(null)}
        onSaved={() => { setEditPhases(null); fetchData(); }}
      />

      <ConfirmDialog
        open={!!deleteStoryTarget}
        onClose={() => setDeleteStoryTarget(null)}
        onConfirm={confirmDeleteStory}
        title="Eliminar Historia de Usuario"
        message={`Vas a eliminar "${deleteStoryTarget?.title ?? ""}". Se borrarán todos sus ciclos, asignaciones, estados y registros diarios. Esta acción es permanente.`}
        details={deleteStoryTarget ? [
          { label: "Ciclos", value: deleteStoryTarget.cycles.length, tone: "warning" },
          { label: "Asignaciones", value: deleteStoryTarget.cycles.reduce((s, c) => s + c.assignments.length, 0), tone: "danger" },
        ] : undefined}
        confirmLabel="Eliminar HU"
        loading={deleting}
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteCycleTarget}
        onClose={() => setDeleteCycleTarget(null)}
        onConfirm={confirmDeleteCycle}
        title={`Eliminar ${deleteCycleTarget?.name ?? "ciclo"}`}
        message={
          deleteCycleTarget?.assignmentCount
            ? `Vas a eliminar "${deleteCycleTarget.name}" junto con sus asignaciones, historial de estados, fases y registros diarios asociados.`
            : `Vas a eliminar "${deleteCycleTarget?.name ?? ""}". No hay asignaciones, la eliminación es limpia.`
        }
        details={deleteCycleTarget?.assignmentCount ? [
          { label: "Asignaciones", value: deleteCycleTarget.assignmentCount, tone: "danger" },
        ] : undefined}
        confirmType={deleteCycleTarget?.assignmentCount ? deleteCycleTarget.name : undefined}
        confirmLabel="Eliminar ciclo"
        loading={deleting}
        variant="destructive"
      />
    </div>
  );
}

function StoryCard({
  story, projectName, clientName, canUpdate, canDelete, canCreateCycle, canDeleteCycle, canAssign, canChangeStatus,
  onEdit, onDelete, onNewCycle, onDeleteCycle, onAssignToCycle, onChangeStatus, onEditPhases,
}: {
  story: Story;
  projectName: string;
  clientName: string;
  canUpdate: boolean;
  canDelete: boolean;
  canCreateCycle: boolean;
  canDeleteCycle: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onNewCycle: () => void;
  onDeleteCycle: (cycleId: string, cycleName: string, assignmentCount: number) => void;
  onAssignToCycle: (cycle: StoryCycle, isFirstCycle: boolean) => void;
  onChangeStatus: (assignmentId: string, status: string) => void;
  onEditPhases: (assignmentId: string, phases: AssignmentPhase[]) => void;
}) {
  // Determine first cycle chronologically (by startDate; fallback to order in array)
  const firstCycleId = (() => {
    if (story.cycles.length === 0) return null;
    const withDates = story.cycles.filter(c => c.startDate);
    if (withDates.length > 0) {
      const sorted = [...withDates].sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1));
      return sorted[0].id;
    }
    return story.cycles[0].id;
  })();
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  async function copyEstimation() {
    const text = buildEstimationText(story, projectName, clientName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create a temporary textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 flex-1 text-left">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          <span className="text-xs font-mono text-gray-500">{story.externalId || "-"}</span>
          <span className="text-sm font-semibold text-gray-900">{story.title}</span>
          <span className="text-[10px] text-gray-400">Dis. <ComplexityBadge value={story.designComplexity} /></span>
          <span className="text-[10px] text-gray-400">Ejec. <ComplexityBadge value={story.executionComplexity} /></span>
          <span className="text-xs text-gray-400 ml-auto">{story.cycles.length} ciclo(s)</span>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={copyEstimation}
            className={`text-xs hover:underline ${copied ? "text-green-600" : "text-gray-600"}`}
            title="Copiar estimación de esta HU al portapapeles"
          >
            {copied ? "✓ Copiado" : "Copiar estimación"}
          </button>
          {canUpdate && <button onClick={onEdit} className="text-xs text-[#2E5FA3] hover:underline">Editar</button>}
          {canDelete && <button onClick={onDelete} className="text-xs text-red-600 hover:underline">Eliminar</button>}
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          {story.cycles.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin ciclos aun.</p>
          ) : (
            story.cycles.map(cycle => (
              <div key={cycle.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{cycle.name}</span>
                    {cycle.startDate && (
                      <span className="text-[10px] text-gray-500">
                        {new Date(cycle.startDate).toLocaleDateString("es")}
                        {cycle.endDate ? ` - ${new Date(cycle.endDate).toLocaleDateString("es")}` : ""}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">· {cycle.assignments.length} asignacion(es)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {canAssign && (
                      <button onClick={() => onAssignToCycle(cycle, cycle.id === firstCycleId)} className="text-[11px] text-[#2E5FA3] hover:underline font-semibold">+ Asignar tester</button>
                    )}
                    {canDeleteCycle && (
                      <button
                        onClick={() => onDeleteCycle(cycle.id, cycle.name, cycle.assignments.length)}
                        className="text-[11px] text-red-600 hover:underline font-medium"
                        title="Eliminar ciclo (y sus asignaciones)"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
                {cycle.assignments.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[9px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="px-3 py-1.5 text-left font-medium">Tester</th>
                        <th className="px-3 py-1.5 text-left font-medium">Estado</th>
                        <th className="px-3 py-1.5 text-left font-medium">Rango</th>
                        <th className="px-3 py-1.5 text-center font-medium" title="Duración planificada (desde→hasta) o días transcurridos si sigue abierta">Duración</th>
                        <th className="px-3 py-1.5 text-center font-medium" title="Días en el estado actual (desde último cambio)">Días en estado</th>
                        {cycle.id === firstCycleId && <th className="px-3 py-1.5 text-right font-medium">Fases</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cycle.assignments.map((a, idx) => {
                        const daysInState = a.daysInStatus ?? null;
                        const inStateRed = daysInState !== null && daysInState > 7;
                        const startD = new Date(a.startDate);
                        const endD = a.endDate ? new Date(a.endDate) : null;
                        const endForCalc = endD ?? new Date();
                        const duration = Math.max(
                          0,
                          Math.floor((endForCalc.getTime() - startD.getTime()) / 86400000) + 1
                        );
                        const open = !endD;
                        return (
                          <tr key={a.id} className={`border-t border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                            <td className="px-3 py-1.5">{a.tester?.name || <span className="text-gray-400">-</span>}</td>
                            <td className="px-3 py-1.5">
                              {canChangeStatus ? (
                                <select
                                  value={a.status}
                                  onChange={e => onChangeStatus(a.id, e.target.value)}
                                  className="px-2 py-0.5 text-[10px] border border-gray-200 rounded bg-white text-gray-700 focus:border-[#4A90D9] outline-none cursor-pointer"
                                >
                                  {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                </select>
                              ) : (
                                <span>{statusMap[a.status]?.label || a.status}</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-gray-500">
                              {startD.toLocaleDateString("es", { day: "2-digit", month: "short" })}
                              {endD
                                ? ` → ${endD.toLocaleDateString("es", { day: "2-digit", month: "short" })}`
                                : " → en curso"}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono text-gray-700">
                              {duration}d{open ? <span className="ml-0.5 text-[9px] text-gray-400">(en curso)</span> : ""}
                            </td>
                            <td className={`px-3 py-1.5 text-center font-mono ${inStateRed ? "text-red-600 font-bold" : "text-gray-500"}`}>
                              {daysInState !== null ? `${daysInState}d` : "-"}
                            </td>
                            {cycle.id === firstCycleId && (
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  onClick={() => onEditPhases(a.id, a.phases ?? [])}
                                  className="text-[10px] text-[#2E5FA3] hover:underline"
                                >
                                  {a.phases && a.phases.length > 0 ? "Editar fases" : "Agregar fases"}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
          {canCreateCycle && (
            <button onClick={onNewCycle} className="text-xs text-[#2E5FA3] hover:underline font-semibold">
              + Nuevo ciclo (Ciclo {story.cycles.length + 1})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ComplexityPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {COMPLEXITIES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
              value === c
                ? c === "HIGH" ? "border-red-400 bg-red-50 text-red-700"
                  : c === "MEDIUM" ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-green-400 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {complexityLabels[c]}
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryFormModal({
  open, onClose, projectId, story, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  story?: Story;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState("");
  const [designComplexity, setDesignComplexity] = useState<string>("MEDIUM");
  const [executionComplexity, setExecutionComplexity] = useState<string>("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(story?.title || "");
      setExternalId(story?.externalId || "");
      setDesignComplexity(story?.designComplexity || "MEDIUM");
      setExecutionComplexity(story?.executionComplexity || "MEDIUM");
      setError("");
    }
  }, [open, story]);

  async function save() {
    if (!title.trim()) { setError("El titulo es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        projectId,
        title: title.trim(),
        externalId: externalId.trim() || null,
        designComplexity,
        executionComplexity,
      };
      if (story) {
        await apiClient(`/api/stories/${story.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiClient(`/api/stories`, { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]";
  return (
    <Modal open={open} onClose={onClose} title={story ? "Editar HU" : "Nueva HU"}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">ID Externo (opcional)</label>
          <input type="text" value={externalId} onChange={e => setExternalId(e.target.value)} className={inp} placeholder="Ej. PROJ-123" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Titulo</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="Descripcion de la HU" />
        </div>
        <ComplexityPicker value={designComplexity} onChange={setDesignComplexity} label="Complejidad de diseno" />
        <ComplexityPicker value={executionComplexity} onChange={setExecutionComplexity} label="Complejidad de ejecucion" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-3 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50">
            {saving ? "Guardando..." : story ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CycleFormModal({
  open, onClose, story, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  story?: Story;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && story) {
      setName(`Ciclo ${story.cycles.length + 1}`);
      setStartDate("");
      setEndDate("");
      setError("");
    }
  }, [open, story]);

  async function save() {
    if (!story) return;
    if (!name.trim()) { setError("Nombre requerido"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/cycles`, {
        method: "POST",
        body: JSON.stringify({
          storyId: story.id,
          name: name.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]";
  return (
    <Modal open={open} onClose={onClose} title={`Nuevo ciclo para: ${story?.title ?? ""}`}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Nombre</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-3 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50">
            {saving ? "Guardando..." : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PHASE_META: Record<"ANALYSIS" | "TEST_DESIGN" | "EXECUTION", { label: string; color: string }> = {
  ANALYSIS: { label: "Análisis", color: "#8b5cf6" },
  TEST_DESIGN: { label: "Diseño de casos", color: "#2E5FA3" },
  EXECUTION: { label: "Ejecución", color: "#0891b2" },
};
const PHASE_ORDER: ("ANALYSIS" | "TEST_DESIGN" | "EXECUTION")[] = ["ANALYSIS", "TEST_DESIGN", "EXECUTION"];

function AssignToCycleModal({
  open, onClose, entry, testers, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entry?: { story: Story; cycle: StoryCycle; isFirstCycle: boolean };
  testers: TesterLite[];
  onSaved: () => void;
}) {
  const [testerId, setTesterId] = useState("");
  const [status, setStatus] = useState("REGISTERED");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [phases, setPhases] = useState<Record<string, { start: string; end: string }>>({
    ANALYSIS: { start: "", end: "" },
    TEST_DESIGN: { start: "", end: "" },
    EXECUTION: { start: "", end: "" },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isFirstCycle = entry?.isFirstCycle ?? false;

  useEffect(() => {
    if (open) {
      // Para Ciclo 2+, pre-seleccionar el tester del ciclo anterior (mismo tester habitual para regresiones)
      let suggestedTesterId = "";
      if (!isFirstCycle && entry?.story?.cycles?.length) {
        const currentCycleStart = entry.cycle.startDate
          ? new Date(entry.cycle.startDate).getTime()
          : Infinity;
        // Buscar el ciclo previo con asignaciones: el más reciente cuyo startDate < currentCycleStart
        const priorCycles = entry.story.cycles
          .filter((c) => {
            if (c.id === entry.cycle.id) return false;
            const cs = c.startDate ? new Date(c.startDate).getTime() : 0;
            return cs < currentCycleStart && c.assignments.length > 0;
          })
          .sort((a, b) => {
            const da = a.startDate ? new Date(a.startDate).getTime() : 0;
            const db = b.startDate ? new Date(b.startDate).getTime() : 0;
            return db - da;
          });
        const lastAssign = priorCycles[0]?.assignments[0];
        if (lastAssign?.tester?.id && testers.some((t) => t.id === lastAssign.tester!.id)) {
          suggestedTesterId = lastAssign.tester.id;
        }
      }
      setTesterId(suggestedTesterId);
      setStatus(isFirstCycle ? "REGISTERED" : "WAITING_QA_DEPLOY");

      // Prellenar con fechas del ciclo si existen
      const cycleStart = entry?.cycle.startDate ? String(entry.cycle.startDate).slice(0, 10) : "";
      const cycleEnd = entry?.cycle.endDate ? String(entry.cycle.endDate).slice(0, 10) : "";
      setStartDate(cycleStart || new Date().toISOString().split("T")[0]);
      setEndDate(cycleEnd);
      setNotes(""); setError("");

      // Para Ciclo 1, si hay rango del ciclo, distribuir sugerencia entre las 3 fases (solo días hábiles L-V)
      if (isFirstCycle && cycleStart && cycleEnd) {
        const toIso = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
        const nextWeekday = (d: Date, dir: 1 | -1 = 1) => {
          const x = new Date(d);
          while (!isWeekday(x)) x.setDate(x.getDate() + dir);
          return x;
        };
        // Construir lista de días hábiles entre cycleStart y cycleEnd (inclusive)
        const days: Date[] = [];
        const cursor = new Date(cycleStart + "T00:00:00");
        const end = new Date(cycleEnd + "T00:00:00");
        while (cursor <= end) {
          if (isWeekday(cursor)) days.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
        if (days.length >= 3) {
          const aCount = Math.max(1, Math.floor(days.length * 0.25));
          const dCount = Math.max(1, Math.floor(days.length * 0.35));
          const eCount = days.length - aCount - dCount;
          const aStart = days[0]!;
          const aEnd = days[aCount - 1]!;
          const dStart = days[aCount]!;
          const dEnd = days[aCount + dCount - 1]!;
          const eStart = days[aCount + dCount]!;
          const eEnd = days[aCount + dCount + eCount - 1]!;
          setPhases({
            ANALYSIS: { start: toIso(aStart), end: toIso(aEnd) },
            TEST_DESIGN: { start: toIso(dStart), end: toIso(dEnd) },
            EXECUTION: { start: toIso(eStart), end: toIso(eEnd) },
          });
        } else {
          // Rango muy corto: deja la distribución vacía para que el líder la ajuste
          setPhases({
            ANALYSIS: { start: "", end: "" },
            TEST_DESIGN: { start: "", end: "" },
            EXECUTION: { start: "", end: "" },
          });
        }
        // También asegurar que startDate/endDate globales no caigan en finde
        if (cycleStart) {
          const s = new Date(cycleStart + "T00:00:00");
          if (!isWeekday(s)) setStartDate(toIso(nextWeekday(s, 1)));
        }
        if (cycleEnd) {
          const e = new Date(cycleEnd + "T00:00:00");
          if (!isWeekday(e)) setEndDate(toIso(nextWeekday(e, -1)));
        }
      } else {
        setPhases({
          ANALYSIS: { start: "", end: "" },
          TEST_DESIGN: { start: "", end: "" },
          EXECUTION: { start: "", end: "" },
        });
      }
    }
  }, [open, isFirstCycle, entry]);

  async function save() {
    if (!entry) return;
    if (!testerId) { setError("Tester obligatorio"); return; }
    setSaving(true); setError("");

    const phasesPayload: { phase: string; startDate: string; endDate: string }[] = [];
    if (isFirstCycle) {
      for (const p of PHASE_ORDER) {
        const v = phases[p];
        if (v.start && v.end) {
          phasesPayload.push({ phase: p, startDate: v.start, endDate: v.end });
        } else if (v.start || v.end) {
          setError(`Fase ${PHASE_META[p].label}: completa inicio y fin o déjala vacía`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      const body: Record<string, unknown> = {
        testerId,
        storyId: entry.story.id,
        cycleId: entry.cycle.id,
        status,
        notes: notes.trim() || null,
      };
      if (phasesPayload.length > 0) {
        body.phases = phasesPayload;
      } else {
        body.startDate = new Date(startDate + "T00:00:00.000Z").toISOString();
        body.endDate = endDate ? new Date(endDate + "T00:00:00.000Z").toISOString() : null;
      }
      await apiClient(`/api/assignments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]";
  return (
    <Modal open={open} onClose={onClose} title={`Asignar a ${entry?.cycle.name ?? ""}: ${entry?.story.title ?? ""}`}>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tester</label>
            {!isFirstCycle && testerId && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sugerido del ciclo anterior
              </span>
            )}
          </div>
          <select value={testerId} onChange={e => setTesterId(e.target.value)} className={inp}>
            <option value="">Seleccionar...</option>
            {testers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {!isFirstCycle && (
            <p className="text-[10px] text-gray-500 mt-1">
              En ciclos de regresión suele ser el mismo tester. Cambialo si quien hace la re-ejecución es otra persona.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Estado inicial</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
            {STATUSES
              .filter(s => {
                if (isFirstCycle) return true;
                // Ciclo 2+: ocultar estados previos (Inicio, Análisis, Diseño)
                return !["REGISTERED", "ANALYSIS", "TEST_DESIGN"].includes(s.value);
              })
              .map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {!isFirstCycle && (
            <p className="text-[10px] text-gray-500 mt-1">
              Ciclo 2+: re-ejecución post-correcciones, arranca desde "Esperando Ambientación QA".
            </p>
          )}
        </div>

        {isFirstCycle ? (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Planificación por fases (Ciclo 1)</p>
            {PHASE_ORDER.map(p => (
              <div key={p} className="border border-gray-200 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: PHASE_META[p].color }} />
                  <span className="text-xs font-semibold text-gray-700">{PHASE_META[p].label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={phases[p].start}
                    onChange={e => setPhases(prev => ({ ...prev, [p]: { ...prev[p], start: e.target.value } }))}
                    className={inp}
                    placeholder="Inicio"
                  />
                  <input
                    type="date"
                    value={phases[p].end}
                    onChange={e => setPhases(prev => ({ ...prev, [p]: { ...prev[p], end: e.target.value } }))}
                    className={inp}
                    placeholder="Fin"
                  />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400">Las fases deben ser días hábiles y no solaparse.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Fecha de inicio</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Fecha de término estimada</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inp} resize-none`} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-3 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50">
            {saving ? "Guardando..." : "Asignar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditPhasesModal({
  open, onClose, assignmentId, initialPhases, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  assignmentId?: string;
  initialPhases: AssignmentPhase[];
  onSaved: () => void;
}) {
  const [phases, setPhases] = useState<Record<string, { start: string; end: string }>>({
    ANALYSIS: { start: "", end: "" },
    TEST_DESIGN: { start: "", end: "" },
    EXECUTION: { start: "", end: "" },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      const base: Record<string, { start: string; end: string }> = {
        ANALYSIS: { start: "", end: "" },
        TEST_DESIGN: { start: "", end: "" },
        EXECUTION: { start: "", end: "" },
      };
      for (const p of initialPhases) {
        base[p.phase] = {
          start: p.startDate.slice(0, 10),
          end: p.endDate.slice(0, 10),
        };
      }
      setPhases(base);
      setReason("");
      setError("");
    }
  }, [open, initialPhases]);

  // Detecta si las fechas actuales difieren del estado inicial.
  function currentFor(phase: string): { start: string; end: string } {
    const found = initialPhases.find((p) => p.phase === phase);
    return {
      start: found ? found.startDate.slice(0, 10) : "",
      end: found ? found.endDate.slice(0, 10) : "",
    };
  }
  const hasChanges = PHASE_ORDER.some((p) => {
    const orig = currentFor(p);
    return phases[p].start !== orig.start || phases[p].end !== orig.end;
  });
  const reasonTooShort = reason.trim().length < 10;
  const saveBlocked = hasChanges && reasonTooShort;

  async function save() {
    if (!assignmentId) return;
    setSaving(true); setError("");
    const payload: { phase: string; startDate: string; endDate: string }[] = [];
    for (const p of PHASE_ORDER) {
      const v = phases[p];
      if (v.start && v.end) {
        payload.push({ phase: p, startDate: v.start, endDate: v.end });
      } else if (v.start || v.end) {
        setError(`Fase ${PHASE_META[p].label}: completa inicio y fin o déjala vacía`);
        setSaving(false);
        return;
      }
    }
    try {
      await apiClient(`/api/assignments/${assignmentId}/phases`, {
        method: "PUT",
        body: JSON.stringify({
          phases: payload,
          ...(hasChanges ? { reason: reason.trim() } : {}),
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]";
  return (
    <Modal open={open} onClose={onClose} title="Editar fases (Ciclo 1)">
      <div className="space-y-2">
        {PHASE_ORDER.map(p => (
          <div key={p} className="border border-gray-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: PHASE_META[p].color }} />
              <span className="text-xs font-semibold text-gray-700">{PHASE_META[p].label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={phases[p].start}
                onChange={e => setPhases(prev => ({ ...prev, [p]: { ...prev[p], start: e.target.value } }))}
                className={inp}
              />
              <input
                type="date"
                value={phases[p].end}
                onChange={e => setPhases(prev => ({ ...prev, [p]: { ...prev[p], end: e.target.value } }))}
                className={inp}
              />
            </div>
          </div>
        ))}
        {hasChanges && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-2.5">
            <label className="block text-[11px] font-semibold text-amber-800 mb-1 uppercase tracking-wider">
              Motivo del cambio de fechas (obligatorio, mín. 10 caracteres)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className={`${inp} resize-none`}
              placeholder="Ej: Se extendió ejecución por retraso en ambiente"
            />
            <p className="text-[10px] text-amber-700 mt-1">
              {reason.trim().length}/10 caracteres mínimos
            </p>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={save} disabled={saving || saveBlocked} className="px-3 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
