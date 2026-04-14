"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface Client { id: string; name: string; }
interface Project { id: string; name: string; }
interface Tester { id: string; name: string; projectId: string; }

export default function EquipoIndexPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient<Client[]>("/api/clients").then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!clientId) { setProjects([]); setProjectId(""); return; }
    apiClient<Project[]>(`/api/projects?clientId=${clientId}`)
      .then(setProjects)
      .catch(() => setProjects([]));
    setProjectId("");
    setTesters([]);
  }, [clientId]);

  useEffect(() => {
    if (!projectId) { setTesters([]); return; }
    setLoading(true);
    apiClient<Tester[]>(`/api/testers?projectId=${projectId}`)
      .then(setTesters)
      .catch(() => setTesters([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1F3864] mb-6">Equipo</h1>

      <div className="grid grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="">Seleccionar...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Proyecto</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!clientId}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50"
          >
            <option value="">Seleccionar...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando testers...</p>}

      {testers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-xs" style={{ backgroundColor: "#1F3864" }}>
                <th className="px-4 py-2 text-left">Tester</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {testers.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/equipo/${t.id}/semana`}
                      className="text-[#2E5FA3] hover:underline text-xs font-medium"
                    >
                      Ver semana →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {projectId && !loading && testers.length === 0 && (
        <p className="text-sm text-gray-500">No hay testers en este proyecto.</p>
      )}
    </div>
  );
}
