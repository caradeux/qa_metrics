"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";

interface Client { id: string; name: string; _count: { projects: number }; }
interface Project { id: string; name: string; modality: "MANUAL" | "AZURE_DEVOPS"; client: { id: string; name: string }; }

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"clients" | "projects">("clients");

  useEffect(() => {
    Promise.all([
      apiClient<Client[]>("/api/clients"),
      apiClient<Project[]>("/api/projects"),
    ]).then(([c, p]) => { setClients(c); setProjects(p); setLoading(false); })
      .catch(() => { setClients([]); setProjects([]); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Vista general de metricas QA</p>
        </div>
        <div className="flex bg-gray-100 rounded-md p-0.5">
          <button onClick={() => setView("clients")} className={`px-3 py-1.5 text-[11px] font-medium rounded transition ${view === "clients" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
            Por Cliente
          </button>
          <button onClick={() => setView("projects")} className={`px-3 py-1.5 text-[11px] font-medium rounded transition ${view === "projects" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
            Por Proyecto
          </button>
        </div>
      </div>

      {view === "clients" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map(client => (
            <Link key={client.id} href={`/dashboard/client/${client.id}`}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:border-[#2E5FA3] hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1F3864] flex items-center justify-center text-white font-bold text-sm group-hover:scale-105 transition-transform">
                  {client.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#2E5FA3] transition">{client.name}</h3>
                  <p className="text-xs text-gray-400">{client._count.projects} proyecto{client._count.projects !== 1 ? "s" : ""}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-[#2E5FA3] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map(project => (
            <Link key={project.id} href={`/dashboard/${project.id}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-[#2E5FA3] hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{project.client.name}</p>
                  <h3 className="font-semibold text-sm text-gray-900 mt-0.5 group-hover:text-[#2E5FA3] transition">{project.name}</h3>
                </div>
                <Badge variant={project.modality === "MANUAL" ? "manual" : "azure"}>
                  {project.modality === "MANUAL" ? "Manual" : "ADO"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400">No hay datos disponibles.</p>
          <Link href="/clients" className="text-xs text-[#2E5FA3] hover:underline mt-2 inline-block">Crear un cliente</Link>
        </div>
      )}
    </div>
  );
}
