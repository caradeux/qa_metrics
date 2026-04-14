"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";

interface ProjectMetric {
  id: string; name: string; modality: string;
  totalDesigned: number; totalExecuted: number; totalDefects: number; ratio: number;
  testerCount: number; cycleCount: number; weekCount: number;
  defectsBySeverity: { critical: number; high: number; medium: number; low: number };
}
interface Totals {
  totalDesigned: number; totalExecuted: number; totalDefects: number; ratio: number;
  rejectionRate: number; totalAssignments: number; rejectedAssignments: number;
  devDeliveryLeadTime: number; devDeliverySamples: number;
  leadTime: Record<string, number>;
  projectCount: number; testerCount: number;
  defectsBySeverity: { critical: number; high: number; medium: number; low: number };
}
interface Data { client: { id: string; name: string }; totals: Totals; projects: ProjectMetric[]; }

export default function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<Data>(`/api/metrics/client?clientId=${clientId}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [clientId]);

  if (loading || !data) return (
    <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
  );

  const { client, totals, projects } = data;
  const sev = totals.defectsBySeverity;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Link href="/dashboard" className="hover:text-[#2E5FA3] transition">Dashboard</Link>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        <span className="text-gray-700 font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#1F3864] flex items-center justify-center text-white font-bold text-sm">
          {client.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-xs text-gray-400">{totals.projectCount} proyectos &middot; {totals.testerCount} testers</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          {
            label: "Diseñados",
            value: totals.totalDesigned.toLocaleString(),
            color: "#2E5FA3",
            icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            desc: "Casos de prueba diseñados.",
            formula: null,
          },
          {
            label: "Ejecutados",
            value: totals.totalExecuted.toLocaleString(),
            color: "#10b981",
            icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
            desc: "Casos de prueba ejecutados.",
            formula: null,
          },
          {
            label: "Defectos",
            value: totals.totalDefects.toLocaleString(),
            color: "#ef4444",
            icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
            desc: "Bugs detectados en la ejecución.",
            formula: null,
          },
          {
            label: "Tasa de Rechazo",
            value: `${totals.rejectionRate ?? 0}%`,
            color: "#dc2626",
            icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
            desc: "HUs devueltas a desarrollo por defectos críticos.",
            formula: "HUs en Devuelto a Dev ÷ Total HUs × 100",
          },
          {
            label: "Entrega de Correcciones",
            value: `${(totals.devDeliveryLeadTime ?? 0).toFixed(1)}d`,
            color: "#f59e0b",
            icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
            desc: "Días promedio que Desarrollo tarda en entregar correcciones entre ciclo y ciclo.",
            formula: "Σ (inicio Ciclo N+1 − fin Ciclo N) ÷ N transiciones",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-lg border border-gray-200 p-4 relative overflow-hidden"
            title={kpi.formula ? `Fórmula: ${kpi.formula}` : kpi.desc}
          >
            <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-lg" style={{ backgroundColor: kpi.color }} />
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke={kpi.color} viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={kpi.icon} /></svg>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="font-mono text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="mt-1.5 text-[10px] leading-tight text-gray-500">{kpi.desc}</p>
            {kpi.formula && (
              <p className="mt-1 inline-block rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] text-gray-600 border border-gray-100">
                {kpi.formula}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Lead Time por estado — detecta cuellos de botella */}
      {totals.leadTime && Object.keys(totals.leadTime).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Lead Time por Estado</p>
              <p className="text-[10px] text-gray-400">Días promedio que una HU permanece en cada estado. Valores altos = cuellos de botella.</p>
            </div>
            <span className="text-[10px] text-gray-400">{totals.totalAssignments ?? 0} asignaciones analizadas</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {(() => {
              const STATUS_META: Record<string, { label: string; color: string }> = {
                REGISTERED: { label: "Inicio", color: "#6b7280" },
                ANALYSIS: { label: "Análisis", color: "#8b5cf6" },
                TEST_DESIGN: { label: "Diseño", color: "#2E5FA3" },
                WAITING_QA_DEPLOY: { label: "Amb. QA", color: "#ea580c" },
                EXECUTION: { label: "Ejecución", color: "#0891b2" },
                RETURNED_TO_DEV: { label: "Devuelto", color: "#ef4444" },
                WAITING_UAT: { label: "Espera UAT", color: "#f59e0b" },
                UAT: { label: "UAT", color: "#d946ef" },
                PRODUCTION: { label: "Producción", color: "#10b981" },
                ON_HOLD: { label: "Detenido", color: "#64748b" },
              };
              const values = Object.entries(totals.leadTime).sort((a, b) => b[1] - a[1]);
              return values.map(([status, days]) => {
                const m = STATUS_META[status] ?? { label: status, color: "#999" };
                const isHot = days >= 7;
                return (
                  <div
                    key={status}
                    className={`rounded-md border p-2 ${isHot ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-gray-50/40"}`}
                    title={`Promedio en ${m.label}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{m.label}</span>
                    </div>
                    <p className={`font-mono text-lg font-bold tabular-nums ${isHot ? "text-red-600" : "text-gray-900"}`}>
                      {days.toFixed(1)}
                      <span className="text-[10px] font-normal text-gray-400 ml-0.5">días</span>
                    </p>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Defects severity bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Defectos por Severidad</p>
        <div className="flex gap-6">
          {[
            { label: "Critico", value: sev.critical, color: "#991b1b", bg: "bg-red-900" },
            { label: "Alto", value: sev.high, color: "#ef4444", bg: "bg-red-500" },
            { label: "Medio", value: sev.medium, color: "#f59e0b", bg: "bg-amber-500" },
            { label: "Bajo", value: sev.low, color: "#84cc16", bg: "bg-lime-500" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className="font-mono text-sm font-bold text-gray-800">{s.value}</span>
            </div>
          ))}
        </div>
        {totals.totalDefects > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden mt-3 bg-gray-100">
            {sev.critical > 0 && <div className="bg-red-900 transition-all" style={{ width: `${(sev.critical / totals.totalDefects) * 100}%` }} />}
            {sev.high > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(sev.high / totals.totalDefects) * 100}%` }} />}
            {sev.medium > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(sev.medium / totals.totalDefects) * 100}%` }} />}
            {sev.low > 0 && <div className="bg-lime-500 transition-all" style={{ width: `${(sev.low / totals.totalDefects) * 100}%` }} />}
          </div>
        )}
      </div>

      {/* Projects table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Proyectos del Cliente</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Proyecto</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Testers</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ciclos</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Diseñados</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ejecutados</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Defectos</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                <td className="px-5 py-3">
                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-gray-600">{p.testerCount}</td>
                <td className="px-3 py-3 text-center font-mono text-sm text-gray-600">{p.cycleCount}</td>
                <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-[#2E5FA3]">{p.totalDesigned.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-emerald-600">{p.totalExecuted.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-red-500">{p.totalDefects.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/dashboard/${p.id}`} className="text-[11px] text-[#2E5FA3] hover:underline font-medium">Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
          {projects.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-3 py-3 text-center font-mono text-sm font-bold text-gray-700">{totals.testerCount}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right font-mono text-sm font-bold text-[#2E5FA3]">{totals.totalDesigned.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-mono text-sm font-bold text-emerald-600">{totals.totalExecuted.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-mono text-sm font-bold text-red-500">{totals.totalDefects.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
