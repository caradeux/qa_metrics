"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient, flowpilotApi, ApiError, type FlowpilotMapping, type FlowpilotCatalogItem } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface UserLite { id: string; name: string; email: string; role?: { name: string } }

const KIND_OPTIONS = ["QA_WORK", "VACACIONES", "LICENCIA", "FERIADO"];

export default function FlowpilotHomologacionPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [mappings, setMappings] = useState<FlowpilotMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<FlowpilotMapping> | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiClient<UserLite[]>("/api/users")
      .then((list) => setUsers(list.filter((u) => u.role?.name === "QA_ANALYST" || u.role?.name === "QA_LEAD")))
      .catch((e) => setError(e?.message ?? "Error cargando usuarios"));
  }, []);

  const loadMappings = useCallback((uid: string) => {
    if (!uid) return;
    setLoading(true);
    flowpilotApi.listMappings(uid)
      .then(setMappings)
      .catch((e) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (userId) loadMappings(userId); }, [userId, loadMappings]);

  if (user && !can("flowpilot-mappings", "read")) {
    return <div className="max-w-md mx-auto mt-24 text-center text-sm text-gray-500">No tienes permiso para la homologación de FlowPilot.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Admin / FlowPilot</div>
        <h1 className="text-xl font-bold text-gray-900">Homologación de carga de horas</h1>
        <p className="text-xs text-gray-400 mt-0.5">Define, por usuario, dónde se imputan sus horas en FlowPilot.</p>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-600">Usuario:</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">Selecciona…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </select>
        {userId && (
          <button onClick={() => setEditing({ userId, kind: "QA_WORK", entityType: "contract" })}
            className="ml-auto text-sm bg-[#2E5FA3] text-white rounded-md px-3 py-1.5 hover:bg-[#264f88]">
            + Agregar homologación
          </button>
        )}
      </div>

      {loading && <div className="text-sm text-gray-400">Cargando…</div>}

      {userId && !loading && (
        <div className="space-y-2">
          {mappings.length === 0 && <div className="text-sm text-gray-400 italic">Sin homologaciones para este usuario.</div>}
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-md px-4 py-3 text-sm">
              <span className="font-semibold text-gray-800 w-28">{m.kind}</span>
              <span className="text-gray-500">{m.entityType === "contract" ? "Contrato" : "Proyecto"}</span>
              <span className="text-gray-700">{m.clientName} — {m.entityName}</span>
              <span className="text-gray-400">· {m.taskTypeName}</span>
              <button onClick={() => setEditing(m)} className="ml-auto text-[#2E5FA3] hover:underline">Editar</button>
              <button onClick={async () => { await flowpilotApi.deleteMapping(m.id); loadMappings(userId); }} className="text-red-600 hover:underline">Eliminar</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MappingEditor
          initial={editing}
          userId={userId}
          reloadKey={reloadKey}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadMappings(userId); }}
          onError={setError}
          onAuthError={() => setNeedsConnect(true)}
        />
      )}

      {needsConnect && (
        <FlowpilotConnectModal
          email={user?.email ?? ""}
          onClose={() => setNeedsConnect(false)}
          onConnected={() => { setNeedsConnect(false); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function MappingEditor({
  initial, userId, reloadKey, onClose, onSaved, onError, onAuthError,
}: {
  initial: Partial<FlowpilotMapping>;
  userId: string;
  reloadKey: number;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
  onAuthError: () => void;
}) {
  const [kind, setKind] = useState(initial.kind ?? "QA_WORK");
  const [entityType, setEntityType] = useState<"contract" | "project">(initial.entityType ?? "contract");
  const [clients, setClients] = useState<FlowpilotCatalogItem[]>([]);
  const [entities, setEntities] = useState<FlowpilotCatalogItem[]>([]);
  const [taskTypes, setTaskTypes] = useState<FlowpilotCatalogItem[]>([]);
  const [clientId, setClientId] = useState<number | null>(initial.clientId ?? null);
  const [entityId, setEntityId] = useState<number | null>(initial.contractId ?? initial.projectId ?? null);
  const [taskTypeId, setTaskTypeId] = useState<number | null>(initial.taskTypeId ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { flowpilotApi.clients(entityType).then(setClients).catch((e) => { if (e instanceof ApiError && e.status === 409) { onAuthError(); } else { onError(e?.message ?? "Error clientes"); } }); }, [entityType, onError, onAuthError, reloadKey]);
  useEffect(() => { flowpilotApi.taskTypes().then(setTaskTypes).catch((e) => { if (e instanceof ApiError && e.status === 409) { onAuthError(); } else { onError(e?.message ?? "Error tipos de tarea"); } }); }, [onError, onAuthError, reloadKey]);
  useEffect(() => {
    if (!clientId) { setEntities([]); return; }
    const p = entityType === "contract" ? flowpilotApi.contracts(clientId) : flowpilotApi.projects(clientId);
    p.then(setEntities).catch((e) => { if (e instanceof ApiError && e.status === 409) { onAuthError(); } else { onError(e?.message ?? "Error entidades"); } });
  }, [clientId, entityType, onError, onAuthError, reloadKey]);

  const save = async () => {
    const client = clients.find((c) => c.id === clientId);
    const entity = entities.find((e) => e.id === entityId);
    const tt = taskTypes.find((t) => t.id === taskTypeId);
    if (!client || !entity || !tt) { onError("Completa cliente, entidad y tipo de tarea"); return; }
    setSaving(true);
    try {
      await flowpilotApi.upsertMapping({
        userId, kind, entityType,
        clientId: client.id, clientName: client.name,
        contractId: entityType === "contract" ? entity.id : null,
        projectId: entityType === "project" ? entity.id : null,
        entityName: entity.name, taskTypeId: tt.id, taskTypeName: tt.name,
      });
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Error guardando");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[460px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">Homologación</h2>
        <Field label="Tipo (kind)">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
            {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Tipo de Entidad">
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value as any); setClientId(null); setEntityId(null); }} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="contract">Contrato</option>
            <option value="project">Proyecto</option>
          </select>
        </Field>
        <Field label="Cliente">
          <select value={clientId ?? ""} onChange={(e) => { setClientId(Number(e.target.value) || null); setEntityId(null); }} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={entityType === "contract" ? "Contrato" : "Proyecto"}>
          <select value={entityId ?? ""} onChange={(e) => setEntityId(Number(e.target.value) || null)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo de Tarea">
          <select value={taskTypeId ?? ""} onChange={(e) => setTaskTypeId(Number(e.target.value) || null)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm px-3 py-1.5 rounded bg-[#2E5FA3] text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function FlowpilotConnectModal({
  email, onClose, onConnected,
}: {
  email: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!password) { setErr("Ingresa tu clave de FlowPilot"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await flowpilotApi.connect(password);
      if (r.valid) { onConnected(); } else { setErr("Credencial inválida"); }
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo conectar con FlowPilot");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">Conectar con FlowPilot</h2>
        <p className="text-xs text-gray-500">
          Para cargar los catálogos necesitamos validar tu cuenta de FlowPilot. Ingresa tu clave de FlowPilot.
        </p>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Correo</label>
          <input value={email} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-500" />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Clave de FlowPilot</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            autoFocus
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>
        {err && <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600">Cancelar</button>
          <button onClick={submit} disabled={busy} className="text-sm px-3 py-1.5 rounded bg-[#2E5FA3] text-white disabled:opacity-50">
            {busy ? "Conectando…" : "Conectar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
