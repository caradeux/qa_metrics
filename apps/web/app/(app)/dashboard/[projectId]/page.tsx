"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import KPICards from "@/components/dashboard/KPICards";
import WeeklyTrendChart from "@/components/dashboard/WeeklyTrendChart";
import CaseTypeDistribution from "@/components/dashboard/CaseTypeDistribution";
import DefectsBySeverity from "@/components/dashboard/DefectsBySeverity";
import ComplexityDistribution from "@/components/dashboard/ComplexityDistribution";
import TesterSummaryTable from "@/components/dashboard/TesterSummaryTable";
import CycleComparison from "@/components/dashboard/CycleComparison";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import { DailyActivityChart } from "@/components/dashboard/DailyActivityChart";
import { apiClient } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
  client: { name: string };
  cycles: Array<{ id: string; name: string }>;
  testers: Array<{ id: string; name: string }>;
}

interface Filters {
  cycleId: string;
  weekFrom: string;
  weekTo: string;
  testerId: string;
}

interface MetricsData {
  kpis: { totalDesigned: number; totalExecuted: number; totalDefects: number; executionRatio: number };
  weeklyTrend: Array<{ weekStart: string; designed: number; executed: number; defects: number }>;
  caseTypeDistribution: {
    functional: { designed: number; executed: number };
    regression: { designed: number; executed: number };
    smoke: { designed: number; executed: number };
    exploratory: { designed: number; executed: number };
  };
  defectsBySeverity: { critical: number; high: number; medium: number; low: number };
  complexityDistribution: { high: number; medium: number; low: number };
  testerSummary: Array<{ testerId: string; testerName: string; designed: number; executed: number; defects: number; ratio: number }>;
  cycleComparison: Array<{ cycleName: string; totalDesigned: number; totalExecuted: number; totalDefects: number; executionRatio: number }>;
}

export default function ProjectDashboard({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCycleComparison, setShowCycleComparison] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    cycleId: "", weekFrom: "", weekTo: "", testerId: "",
  });

  useEffect(() => {
    apiClient<Project>(`/api/projects/${projectId}`)
      .then(setProject)
      .catch((err) => console.error(err));
  }, [projectId]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ projectId });
    if (filters.cycleId) params.set("cycleId", filters.cycleId);
    if (filters.weekFrom) params.set("weekFrom", filters.weekFrom);
    if (filters.weekTo) params.set("weekTo", filters.weekTo);
    if (filters.testerId) params.set("testerId", filters.testerId);

    try {
      const data = await apiClient<MetricsData>(`/api/metrics?${params}`);
      setMetrics(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [projectId, filters]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  /* Loading skeleton with shimmer */
  if (!project) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-64 animate-shimmer rounded" />
        <div className="h-8 w-48 animate-shimmer rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 animate-shimmer rounded-lg" />
          ))}
        </div>
        <div className="h-64 animate-shimmer rounded-lg mt-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-4 animate-fadeInUp">
        <Link href="/dashboard" className="hover:text-secondary transition-colors font-medium">
          Dashboard
        </Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>{project.client.name}</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-600 font-medium">{project.name}</span>
      </nav>

      {/* Header with export buttons */}
      <div className="flex items-center justify-between mb-6 animate-fadeInUp" style={{ animationDelay: "50ms" }}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{project.name}</h1>
          <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">{project.client.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const filterParams = new URLSearchParams(filters as unknown as Record<string, string>);
                const blob = await apiClient<Blob>(`/api/reports/excel?projectId=${projectId}&${filterParams}`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `reporte-${project.name}.xlsx`; a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel
          </button>
          <button
            onClick={async () => {
              try {
                const blob = await apiClient<Blob>("/api/reports/pdf", {
                  method: "POST",
                  body: JSON.stringify({ projectId, ...filters }),
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `reporte-${project.name}.pdf`; a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Collapsible filters panel */}
      <div className="bg-white rounded-lg shadow-sm border border-border mb-6 animate-fadeInUp" style={{ animationDelay: "100ms" }}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span>Filtros</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: filtersOpen ? "500px" : "0", opacity: filtersOpen ? 1 : 0 }}
        >
          <div className="px-4 pb-4">
            <DashboardFilters
              cycles={project.cycles}
              testers={project.testers}
              filters={filters}
              onFilterChange={setFilters}
            />
          </div>
        </div>
      </div>

      {/* Metrics content */}
      {loading ? (
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 animate-shimmer rounded-lg" />
            ))}
          </div>
          <div className="h-64 animate-shimmer rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 animate-shimmer rounded-lg" />
            ))}
          </div>
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <KPICards kpis={metrics.kpis} />

          {/* Daily Activity (L-V) */}
          <DailyActivityChart projectId={projectId} />

          {/* Weekly Trend - full width */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
            style={{ borderTop: "3px solid #2E5FA3", animationDelay: "150ms" }}
          >
            <div className="p-5">
              <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium mb-4">
                Tendencia Semanal
              </h3>
              <WeeklyTrendChart data={metrics.weeklyTrend} />
            </div>
          </div>

          {/* 2x2 Distribution grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
              style={{ borderTop: "3px solid #10b981", animationDelay: "200ms" }}
            >
              <div className="p-5">
                <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium mb-4">
                  Distribucion por Tipo de Caso
                </h3>
                <CaseTypeDistribution data={metrics.caseTypeDistribution} />
              </div>
            </div>

            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
              style={{ borderTop: "3px solid #ef4444", animationDelay: "250ms" }}
            >
              <div className="p-5">
                <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium mb-4">
                  Defectos por Severidad
                </h3>
                <DefectsBySeverity data={metrics.defectsBySeverity} />
              </div>
            </div>

            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
              style={{ borderTop: "3px solid #f59e0b", animationDelay: "300ms" }}
            >
              <div className="p-5">
                <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium mb-4">
                  Historias por Complejidad
                </h3>
                <ComplexityDistribution data={metrics.complexityDistribution} />
              </div>
            </div>

            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
              style={{ borderTop: "3px solid #8b5cf6", animationDelay: "350ms" }}
            >
              <div className="p-5">
                <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium mb-4">
                  Resumen por Tester
                </h3>
                <TesterSummaryTable data={metrics.testerSummary} />
              </div>
            </div>
          </div>

          {/* Cycle Comparison - full width */}
          <div
            className="bg-white rounded-lg shadow-sm overflow-hidden animate-fadeInUp"
            style={{ borderTop: "3px solid #6366f1", animationDelay: "400ms" }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="uppercase tracking-wider text-xs text-gray-400 font-medium">
                  Comparativa entre Ciclos
                </h3>
                {/* Sleek toggle switch */}
                <button
                  onClick={() => setShowCycleComparison(!showCycleComparison)}
                  className="relative inline-flex items-center gap-2 group"
                  aria-pressed={showCycleComparison}
                >
                  <span className="text-[11px] text-gray-400 font-medium group-hover:text-gray-600 transition-colors">
                    {showCycleComparison ? "Ocultar" : "Mostrar"}
                  </span>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      showCycleComparison ? "bg-indigo-500" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        showCycleComparison ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              {showCycleComparison && <CycleComparison data={metrics.cycleComparison} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
