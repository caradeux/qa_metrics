"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Assignment {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  tester: {
    id: string;
    name: string;
    project: {
      id: string;
      name: string;
      client: { id: string; name: string };
    };
  };
  story: {
    id: string;
    title: string;
    externalId?: string | null;
    designComplexity?: string;
    executionComplexity?: string;
  };
  cycle: { id: string; name: string };
}

interface ClientLite { id: string; name: string }

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Inicio",
  ANALYSIS: "En Análisis",
  TEST_DESIGN: "Diseño de Casos",
  WAITING_QA_DEPLOY: "Esperando Ambiente QA",
  EXECUTION: "En Ejecución",
  RETURNED_TO_DEV: "Devuelto a Dev",
  WAITING_UAT: "Espera UAT",
  UAT: "En UAT",
  PRODUCTION: "Producción",
  ON_HOLD: "Detenido",
};

const STATUS_COLOR: Record<string, string> = {
  REGISTERED: "#94a3b8",
  ANALYSIS: "#8b5cf6",
  TEST_DESIGN: "#2E5FA3",
  WAITING_QA_DEPLOY: "#f59e0b",
  EXECUTION: "#0891b2",
  RETURNED_TO_DEV: "#dc2626",
  WAITING_UAT: "#ea580c",
  UAT: "#059669",
  PRODUCTION: "#10b981",
  ON_HOLD: "#6b7280",
};

const COMPLEXITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-green-100 text-green-800",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function TesterReportPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeProduction, setIncludeProduction] = useState(false);
  const [clientFilter, setClientFilter] = useState("");

  useEffect(() => {
    apiClient<Assignment[]>("/api/assignments")
      .then((data) => setAssignments(data))
      .catch((err: any) => setError(err?.message || "Error al cargar"))
      .finally(() => setLoading(false));
    apiClient<ClientLite[] | { clients: ClientLite[] }>("/api/clients")
      .then((res) => setClients(Array.isArray(res) ? res : res.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  // Agrupar tester → proyecto → HUs
  const grouped = useMemo(() => {
    let filtered = includeProduction
      ? assignments
      : assignments.filter((a) => a.status !== "PRODUCTION");
    if (clientFilter) {
      filtered = filtered.filter((a) => a.tester.project.client.id === clientFilter);
    }

    // Agrupa por nombre de tester: el mismo analista puede tener Tester distintos
    // en cada proyecto (el modelo es por-proyecto), pero conceptualmente es la
    // misma persona para efectos de visualización.
    const byTester = new Map<string, {
      testerName: string;
      projects: Map<string, {
        projectId: string;
        projectName: string;
        clientName: string;
        assignments: Assignment[];
      }>;
    }>();

    for (const a of filtered) {
      const tKey = a.tester.name.trim().toLowerCase();
      if (!byTester.has(tKey)) {
        byTester.set(tKey, {
          testerName: a.tester.name,
          projects: new Map(),
        });
      }
      const tester = byTester.get(tKey)!;
      const pKey = a.tester.project.id;
      if (!tester.projects.has(pKey)) {
        tester.projects.set(pKey, {
          projectId: pKey,
          projectName: a.tester.project.name,
          clientName: a.tester.project.client.name,
          assignments: [],
        });
      }
      tester.projects.get(pKey)!.assignments.push(a);
    }

    return Array.from(byTester.values())
      .map((t) => ({
        ...t,
        projects: Array.from(t.projects.values()).sort((a, b) =>
          a.projectName.localeCompare(b.projectName),
        ),
      }))
      .sort((a, b) => a.testerName.localeCompare(b.testerName));
  }, [assignments, includeProduction]);

  const totalTesters = grouped.length;
  const totalHU = grouped.reduce(
    (acc, t) => acc + t.projects.reduce((a, p) => a + p.assignments.length, 0),
    0,
  );

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg m-6" />;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Reporte por Tester</h1>
      <p className="text-sm text-muted mb-6">
        HUs asignadas agrupadas por tester y proyecto. Por defecto oculta las HUs ya en producción.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm"
            style={{ minWidth: 220 }}
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm pb-1.5">
          <input
            type="checkbox"
            checked={includeProduction}
            onChange={(e) => setIncludeProduction(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary"
          />
          <span>Incluir HUs en Producción</span>
        </label>
        <div className="ml-auto text-xs text-gray-500 pb-1.5">
          {totalTesters} tester(s) · {totalHU} HU(s) activas
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {grouped.length === 0 && (
        <div className="bg-card p-8 rounded-xl border border-border text-center">
          <p className="text-sm text-gray-500">No hay HUs activas asignadas.</p>
        </div>
      )}

      <div className="space-y-5">
        {grouped.map((tester) => (
          <div
            key={tester.testerName}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-[#1F3864] to-[#2E5FA3]">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
                {tester.testerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <h2 className="text-base font-semibold text-white flex-1">{tester.testerName}</h2>
              <span className="text-xs font-medium text-white/80">
                {tester.projects.reduce((a, p) => a + p.assignments.length, 0)} HU(s)
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {tester.projects.map((project) => (
                <div key={project.projectId} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {!clientFilter && (
                      <>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">{project.clientName}</span>
                        <span className="text-gray-300">·</span>
                      </>
                    )}
                    <span className="text-sm font-semibold text-[#1F3864]">{project.projectName}</span>
                    <span className="ml-auto text-[11px] text-gray-400">
                      {project.assignments.length} HU(s)
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {project.assignments
                      .sort((a, b) => {
                        const byTitle = a.story.title.localeCompare(b.story.title);
                        if (byTitle !== 0) return byTitle;
                        return a.cycle.name.localeCompare(b.cycle.name, "es", { numeric: true });
                      })
                      .map((a) => (
                        <li
                          key={a.id}
                          className="flex items-start gap-3 text-sm bg-gray-50/50 rounded px-3 py-2 hover:bg-gray-50"
                        >
                          <span
                            className="mt-1 w-2 h-2 rounded-full shrink-0"
                            style={{ background: STATUS_COLOR[a.status] ?? "#888" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.story.externalId && (
                                <span className="text-[11px] font-mono text-gray-500">
                                  {a.story.externalId}
                                </span>
                              )}
                              <span className="text-gray-800 break-words">{a.story.title}</span>
                              {a.story.executionComplexity && (
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                    COMPLEXITY_BADGE[a.story.executionComplexity] ?? ""
                                  }`}
                                >
                                  {a.story.executionComplexity}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                              <span
                                className="px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  background: `${STATUS_COLOR[a.status] ?? "#888"}20`,
                                  color: STATUS_COLOR[a.status] ?? "#888",
                                }}
                              >
                                {STATUS_LABEL[a.status] ?? a.status}
                              </span>
                              <span>·</span>
                              <span>{a.cycle.name}</span>
                              <span>·</span>
                              <span>
                                {formatDate(a.startDate)}
                                {a.endDate ? ` → ${formatDate(a.endDate)}` : " → en curso"}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
