"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { Modal } from "@/components/ui/Modal";
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

export default function ProjectStoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { can } = usePermissions();
  const [data, setData] = useState<StoriesResponse | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [testers, setTesters] = useState<TesterLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [editStory, setEditStory] = useState<Story | null>(null);
  const [newStoryOpen, setNewStoryOpen] = useState(false);
  const [newCycleForStory, setNewCycleForStory] = useState<Story | null>(null);
  const [assignToCycle, setAssignToCycle] = useState<{ story: Story; cycle: StoryCycle; isFirstCycle: boolean } | null>(null);
  const [editPhases, setEditPhases] = useState<{ assignmentId: string; phases: AssignmentPhase[] } | null>(null);

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

  async function changeStatus(assignmentId: string, status: string) {
    const body: Record<string, unknown> = { status };
    if (status === "PRODUCTION") body.endDate = new Date().toISOString().split("T")[0];
    try {
      await apiClient(`/api/assignments/${assignmentId}`, { method: "PUT", body: JSON.stringify(body) });
      fetchData();
    } catch (e) { console.error(e); }
  }

  async function deleteStory(id: string) {
    if (!confirm("Eliminar HU? Esta accion elimina tambien sus ciclos y asignaciones.")) return;
    try {
      await apiClient(`/api/stories/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e) { console.error(e); }
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

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : !data || data.stories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">No hay historias de usuario aun.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              canUpdate={can("stories", "update")}
              canDelete={can("stories", "delete")}
              canCreateCycle={can("cycles", "create")}
              canAssign={can("assignments", "create")}
              canChangeStatus={can("assignments", "update")}
              onEdit={() => setEditStory(story)}
              onDelete={() => deleteStory(story.id)}
              onNewCycle={() => setNewCycleForStory(story)}
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
    </div>
  );
}

function StoryCard({
  story, canUpdate, canDelete, canCreateCycle, canAssign, canChangeStatus,
  onEdit, onDelete, onNewCycle, onAssignToCycle, onChangeStatus, onEditPhases,
}: {
  story: Story;
  canUpdate: boolean;
  canDelete: boolean;
  canCreateCycle: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onNewCycle: () => void;
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
                  {canAssign && (
                    <button onClick={() => onAssignToCycle(cycle, cycle.id === firstCycleId)} className="text-[11px] text-[#2E5FA3] hover:underline font-semibold">+ Asignar tester</button>
                  )}
                </div>
                {cycle.assignments.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[9px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="px-3 py-1.5 text-left font-medium">Tester</th>
                        <th className="px-3 py-1.5 text-left font-medium">Estado</th>
                        <th className="px-3 py-1.5 text-left font-medium">Inicio</th>
                        <th className="px-3 py-1.5 text-center font-medium">Dias</th>
                        {cycle.id === firstCycleId && <th className="px-3 py-1.5 text-right font-medium">Fases</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cycle.assignments.map((a, idx) => {
                        const days = a.daysInStatus ?? null;
                        const daysRed = days !== null && days > 7;
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
                            <td className="px-3 py-1.5 text-gray-500">{new Date(a.startDate).toLocaleDateString("es")}</td>
                            <td className={`px-3 py-1.5 text-center font-mono ${daysRed ? "text-red-600 font-bold" : "text-gray-500"}`}>
                              {days !== null ? `${days}d` : "-"}
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
      setTesterId(""); setStatus("REGISTERED");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setNotes(""); setError("");
      setPhases({
        ANALYSIS: { start: "", end: "" },
        TEST_DESIGN: { start: "", end: "" },
        EXECUTION: { start: "", end: "" },
      });
    }
  }, [open]);

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
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Tester</label>
          <select value={testerId} onChange={e => setTesterId(e.target.value)} className={inp}>
            <option value="">Seleccionar...</option>
            {testers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Estado inicial</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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
      setError("");
    }
  }, [open, initialPhases]);

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
        body: JSON.stringify({ phases: payload }),
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
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-3 py-2 text-xs font-semibold text-white bg-[#1F3864] rounded-md hover:bg-[#2E5FA3] disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
