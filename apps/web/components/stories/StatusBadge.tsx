"use client";

export const STATUSES = [
  { value: "REGISTERED", label: "Inicio", short: "INI", color: "#6b7280", bg: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400", step: 1 },
  { value: "ANALYSIS", label: "En Analisis", short: "ANA", color: "#8b5cf6", bg: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", step: 2 },
  { value: "TEST_DESIGN", label: "Diseno de Casos", short: "DIS", color: "#2E5FA3", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", step: 3 },
  { value: "WAITING_QA_DEPLOY", label: "Esperando Ambientación QA", short: "AMB", color: "#ea580c", bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", step: 4 },
  { value: "EXECUTION", label: "En Ejecucion", short: "EJE", color: "#0891b2", bg: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", step: 5 },
  { value: "RETURNED_TO_DEV", label: "Devuelto a Dev", short: "DEV", color: "#ef4444", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", step: 5 },
  { value: "WAITING_UAT", label: "Espera UAT", short: "ESP", color: "#f59e0b", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", step: 6 },
  { value: "UAT", label: "En UAT", short: "UAT", color: "#d946ef", bg: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", dot: "bg-fuchsia-500", step: 7 },
  { value: "PRODUCTION", label: "Produccion", short: "PRD", color: "#10b981", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", step: 8 },
  { value: "ON_HOLD", label: "Detenido", short: "HOLD", color: "#64748b", bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500", step: 9 },
] as const;

export const ACTIVE_STATUSES = ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION"] as const;
export const IDLE_STATUSES = ["RETURNED_TO_DEV", "WAITING_UAT", "UAT", "PRODUCTION", "ON_HOLD"] as const;
export function isActiveStatus(s: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(s);
}

export const statusMap = Object.fromEntries(STATUSES.map(s => [s.value, s]));

export const complexityBadge: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
};

export const complexityLabel: Record<string, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function ComplexityBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${complexityBadge[value] || ""}`} title={label}>
      {complexityLabel[value] || value}
    </span>
  );
}
