"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { Modal } from "@/components/ui/Modal";
import { STATUSES, statusMap, ComplexityBadge } from "@/components/stories/StatusBadge";

interface CycleLite { id: string; name: string; startDate?: string | null; endDate?: string | null }
interface TesterLite { id: string; name: string }
interface CurrentAssignment {
  id: string;
  cycleId: string;
  cycle: CycleLite | null;
  tester: TesterLite | null;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  daysInStatus: number | null;
}
interface Story {
  id: string;
  externalId: string | null;
  title: string;
  designComplexity: string;
  executionComplexity: string;
  projectId: string;
  assignmentsCount: number;
  currentAssignment: CurrentAssignment | null;
}
interface ByCycleGroup { cycle: CycleLite | null; stories: Story[] }
interface StoriesResponse { projectId: string; byCycle: ByCycleGroup[] }
interface ProjectDetail { id: string; name: string; client: { name: string } }

const COMPLEXITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const complexityLabels: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };

export default function ProjectStoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { can } = usePermissions();
  const [data, setData] = useState<StoriesResponse | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [cycles, setCycles] = useState<CycleLite[]>([]);
  const [testers, setTesters] = useState<TesterLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCycle, setFilterCycle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTester, setFilterTester] = useState("");

  // Modals
  const [editStory, setEditStory] = useState<Story | null>(null);
  const [newStoryOpen, setNewStoryOpen] = useState(false);
  const [assignStory, setAssignStory] = useState<Story | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient<StoriesResponse>(`/api/projects/${projectId}/stories`);
      setData(res);
    } catch {
      setData({ projectId, byCycle: [] });
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    apiClient<ProjectDetail>(`/api/projects/${projectId}`).then(setProject).catch(() => setProject(null));
    apiClient<CycleLite[]>(`/api/cycles?projectId=${projectId}`).then(setCycles).catch(() => setCycles([]));
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
    if (!confirm("Eliminar HU? Esta accion elimina tambien sus asignaciones.")) return;
    try {
      await apiClient(`/api/stories/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e) { console.error(e); }
  }

  function filterStories(stories: Story[]): Story[] {
    return stories.filter(s => {
      if (filterStatus && s.currentAssignment?.status !== filterStatus) return false;
      if (filterTester && s.currentAssignment?.tester?.id !== filterTester) return false;
      return true;
    });
  }

  // Filter groups by cycle
  const displayGroups = (data?.byCycle || [])
    .filter(g => !filterCycle || (filterCycle === "none" ? g.cycle === null : g.cycle?.id === filterCycle))
    .map(g => ({ ...g, stories: filterStories(g.stories) }))
    .filter(g => g.stories.length > 0 || !filterStatus && !filterTester);

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filterCycle} onChange={e => setFilterCycle(e.target.value)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none">
          <option value="">Todos los ciclos</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Sin ciclo</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterTester} onChange={e => setFilterTester(e.target.value)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#4A90D9] outline-none">
          <option value="">Todos los testers</option>
          {testers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : displayGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">No hay historias de usuario aun.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayGroups.map(group => (
            <CycleBlock
              key={group.cycle?.id ?? "none"}
              group={group}
              canUpdate={can("stories", "update")}
              canDelete={can("stories", "delete")}
              canAssign={can("assignments", "create")}
              canChangeStatus={can("assignments", "update")}
              onEdit={setEditStory}
              onDelete={deleteStory}
              onAssign={setAssignStory}
              onChangeStatus={changeStatus}
            />
          ))}
        </div>
      )}

      {/* Modals */}
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
      <AssignToCycleModal
        open={!!assignStory}
        story={assignStory ?? undefined}
        cycles={cycles}
        testers={testers}
        onClose={() => setAssignStory(null)}
        onSaved={() => { setAssignStory(null); fetchData(); }}
      />
    </div>
  );
}

function CycleBlock({
  group, canUpdate, canDelete, canAssign, canChangeStatus,
  onEdit, onDelete, onAssign, onChangeStatus,
}: {
  group: ByCycleGroup;
  canUpdate: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  onEdit: (s: Story) => void;
  onDelete: (id: string) => void;
  onAssign: (s: Story) => void;
  onChangeStatus: (assignmentId: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          <h3 className="text-sm font-bold text-gray-900">
            {group.cycle ? group.cycle.name : "Sin asignacion / Sin ciclo"}
          </h3>
          <span className="text-xs text-gray-400">{group.stories.length} HU</span>
        </div>
      </button>
      {expanded && (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="px-4 py-2 font-medium">Ext ID</th>
              <th className="px-4 py-2 font-medium">Titulo</th>
              <th className="px-4 py-2 font-medium text-center">Dis.</th>
              <th className="px-4 py-2 font-medium text-center">Ejec.</th>
              <th className="px-4 py-2 font-medium">Tester</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium text-center">Dias</th>
              <th className="px-4 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {group.stories.map((s, idx) => {
              const current = s.currentAssignment;
              const days = current?.daysInStatus ?? null;
              const daysRed = days !== null && days > 7;
              return (
                <tr key={s.id} className={`border-t border-gray-50 hover:bg-gray-50/50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-4 py-2 text-xs font-mono text-gray-500">{s.externalId || "-"}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{s.title}</td>
                  <td className="px-4 py-2 text-center"><ComplexityBadge value={s.designComplexity} /></td>
                  <td className="px-4 py-2 text-center"><ComplexityBadge value={s.executionComplexity} /></td>
                  <td className="px-4 py-2 text-xs text-gray-700">{current?.tester?.name || <span className="text-gray-400">Sin asignar</span>}</td>
                  <td className="px-4 py-2">
                    {current ? (
                      canChangeStatus ? (
                        <select
                          value={current.status}
                          onChange={e => onChangeStatus(current.id, e.target.value)}
                          className="px-2 py-1 text-[10px] border border-gray-200 rounded-md bg-white text-gray-700 focus:border-[#4A90D9] outline-none cursor-pointer hover:border-gray-300"
                        >
                          {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs">{statusMap[current.status]?.label || current.status}</span>
                      )
                    ) : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  <td className={`px-4 py-2 text-center text-xs font-mono ${daysRed ? "text-red-600 font-bold" : "text-gray-500"}`}>
                    {days !== null ? `${days}d` : "-"}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {canUpdate && (
                      <button onClick={() => onEdit(s)} className="text-xs text-[#2E5FA3] hover:underline">Editar</button>
                    )}
                    {canAssign && (
                      <button onClick={() => onAssign(s)} className="text-xs text-[#2E5FA3] hover:underline">Asignar</button>
                    )}
                    {canDelete && (
                      <button onClick={() => onDelete(s.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

function AssignToCycleModal({
  open, onClose, story, cycles, testers, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  story?: Story;
  cycles: CycleLite[];
  testers: TesterLite[];
  onSaved: () => void;
}) {
  const [cycleId, setCycleId] = useState("");
  const [testerId, setTesterId] = useState("");
  const [status, setStatus] = useState("REGISTERED");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCycleId(""); setTesterId(""); setStatus("REGISTERED");
      setStartDate(new Date().toISOString().split("T")[0]);
      setNotes(""); setError("");
    }
  }, [open]);

  async function save() {
    if (!story) return;
    if (!cycleId || !testerId) { setError("Ciclo y tester son obligatorios"); return; }
    setSaving(true); setError("");
    try {
      await apiClient(`/api/assignments`, {
        method: "POST",
        body: JSON.stringify({
          testerId, storyId: story.id, cycleId, status,
          startDate: new Date(startDate).toISOString(),
          notes: notes.trim() || null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]";
  return (
    <Modal open={open} onClose={onClose} title={`Asignar: ${story?.title ?? ""}`}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Ciclo</label>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)} className={inp}>
            <option value="">Seleccionar...</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Tester</label>
          <select value={testerId} onChange={e => setTesterId(e.target.value)} className={inp}>
            <option value="">Seleccionar...</option>
            {testers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Estado inicial</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Fecha de inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} />
          </div>
        </div>
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
