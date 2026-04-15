"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

// Paleta temática por métrica (coherente con WeeklyGrid)
const METRIC = {
  designed: { label: "Diseñados", color: "#2E5FA3", gradient: ["#2E5FA3", "#1F3864"] },
  executed: { label: "Ejecutados", color: "#0891b2", gradient: ["#0891b2", "#0e7490"] },
  defects: { label: "Defectos", color: "#dc2626", gradient: ["#dc2626", "#991b1b"] },
};

// Paleta para series por proyecto (colores diferenciados y profesionales)
const SERIES_COLORS = ["#1F3864", "#0891b2", "#dc2626", "#7c3aed", "#ea580c", "#16a34a", "#db2777", "#0d9488"];

interface SeriesTotal {
  labels: string[];
  values: number[];
}
interface SeriesByProject {
  project: string;
  values: number[];
}
interface Props {
  data: {
    client: { id: string; name: string };
    labels: string[];
    designedTotal: SeriesTotal;
    designedByProject: SeriesByProject[];
    designedAverage: SeriesTotal;
    executedTotal: SeriesTotal;
    executedByProject: SeriesByProject[];
    executedAverage: SeriesTotal;
    defectsTotal: SeriesTotal;
    defectsByProject: SeriesByProject[];
    analysts: { project: string; testers: string[] }[];
  };
  mode: "monthly" | "weekly";
  months: number;
  weeks: number;
  onChangeMode: (m: "monthly" | "weekly") => void;
  onChangeMonths: (n: number) => void;
  onChangeWeeks: (n: number) => void;
}

const ICONS = {
  designed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  executed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  defects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  average: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l3-3 4 6 5-9 6 12" />
    </svg>
  ),
};

function singleSeries(data: SeriesTotal) {
  return data.labels.map((m, i) => ({ label: m, value: data.values[i] ?? 0 }));
}

function multiSeries(labels: string[], series: SeriesByProject[]) {
  return labels.map((m, i) => {
    const row: Record<string, number | string> = { label: m };
    for (const s of series) row[s.project] = s.values[i] ?? 0;
    return row;
  });
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color ?? p.fill }} />
          <span className="text-gray-700">{p.name}:</span>
          <span className="font-mono font-semibold tabular-nums text-gray-900">{p.value}{unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-bold text-[#1F3864]">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  icon,
  accent,
  trend,
  subtitle,
  hint,
  suffix,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  trend?: { delta: number; period: string };
  subtitle?: string;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div
      title={hint}
      className="relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md print:shadow-none"
    >
      <div
        className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full opacity-10"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
            {title}
            {hint && (
              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: accent }}>
            {value.toLocaleString("es-CL")}{suffix ?? ""}
          </p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
          {trend && (
            <p className="text-[10px] text-gray-400">
              {trend.delta >= 0 ? "▲" : "▼"} {Math.abs(trend.delta)}% vs {trend.period}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SingleBarCard({
  title,
  subtitle,
  data,
  metric,
  icon,
}: {
  title: string;
  subtitle?: string;
  data: SeriesTotal;
  metric: "designed" | "executed" | "defects";
  icon?: React.ReactNode;
}) {
  const m = METRIC[metric];
  const gradId = `grad-${metric}-${title.replace(/\s+/g, "-")}`;
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md print:shadow-none">
      <SectionTitle icon={icon ?? ICONS[metric]} title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={singleSeries(data)} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.gradient[0]} stopOpacity={0.95} />
              <stop offset="100%" stopColor={m.gradient[1]} stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: `${m.color}10` }} />
          <Bar
            dataKey="value"
            fill={`url(#${gradId})`}
            name={m.label}
            radius={[6, 6, 0, 0]}
            label={{ position: "top", fontSize: 11, fill: "#374151", fontWeight: 600 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AverageLineCard({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle?: string;
  data: SeriesTotal;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md print:shadow-none">
      <SectionTitle icon={ICONS.average} title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={singleSeries(data)} margin={{ top: 20, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={{ fill: color, r: 5, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 7 }}
            name={title}
            label={{ position: "top", fontSize: 11, fill: "#374151", fontWeight: 600 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarCard({
  title,
  subtitle,
  labels,
  series,
  icon,
}: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: SeriesByProject[];
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md print:shadow-none">
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={multiSeries(labels, series)} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1F386410" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          {series.map((s, i) => (
            <Bar
              key={s.project}
              dataKey={s.project}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClientMonthlyReport({
  data,
  mode,
  months,
  weeks,
  onChangeMode,
  onChangeMonths,
  onChangeWeeks,
}: Props) {
  const isMonthly = mode === "monthly";
  const unitSingular = isMonthly ? "Mes" : "Semana";
  const unitPlural = isMonthly ? "meses" : "semanas";
  const count = isMonthly ? months : weeks;

  const totals = {
    designed: sum(data.designedTotal.values),
    executed: sum(data.executedTotal.values),
    defects: sum(data.defectsTotal.values),
  };
  const ratio = totals.designed > 0 ? Math.round((totals.executed / totals.designed) * 100) : 0;

  return (
    <div className="p-6">
      <style jsx global>{`
        @media print {
          aside,
          header.print-hide,
          .print-hide {
            display: none !important;
          }
          body {
            background: white;
          }
          .shadow-sm,
          .shadow-md {
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* HEADER con gradiente */}
      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-[#1F3864] to-[#2E5FA3] p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Reporte {isMonthly ? "Mensual" : "Semanal"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{data.client.name}</h1>
            <p className="text-sm text-white/70">
              Indicadores de {isMonthly ? "los últimos" : "las últimas"} {count} {unitPlural}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 print-hide">
            <div className="inline-flex rounded-lg bg-white/10 p-0.5 backdrop-blur-sm">
              <button
                onClick={() => onChangeMode("monthly")}
                className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                  isMonthly ? "bg-white text-[#1F3864] shadow-sm" : "text-white/80 hover:bg-white/10"
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => onChangeMode("weekly")}
                className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                  !isMonthly ? "bg-white text-[#1F3864] shadow-sm" : "text-white/80 hover:bg-white/10"
                }`}
              >
                Semanal
              </button>
            </div>
            {isMonthly ? (
              <select
                value={months}
                onChange={(e) => onChangeMonths(Number(e.target.value))}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white backdrop-blur-sm focus:outline-none"
              >
                {[3, 6, 9, 12].map((n) => (
                  <option key={n} value={n} className="text-gray-900">
                    {n} meses
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={weeks}
                onChange={(e) => onChangeWeeks(Number(e.target.value))}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white backdrop-blur-sm focus:outline-none"
              >
                {[4, 8, 12, 26].map((n) => (
                  <option key={n} value={n} className="text-gray-900">
                    {n} semanas
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          title="Total Diseñados"
          value={totals.designed}
          icon={ICONS.designed}
          accent={METRIC.designed.color}
          subtitle="Casos de prueba creados"
          hint="Total de casos de prueba que se diseñaron en el período del reporte."
        />
        <KPICard
          title="Total Ejecutados"
          value={totals.executed}
          icon={ICONS.executed}
          accent={METRIC.executed.color}
          subtitle="Casos de prueba ejecutados"
          hint="Casos ejecutados (corridos) por los testers en el período del reporte."
        />
        <KPICard
          title="Total Defectos"
          value={totals.defects}
          icon={ICONS.defects}
          accent={METRIC.defects.color}
          subtitle="Bugs detectados"
          hint="Incidencias o defectos reportados por los testers en el período."
        />
        <KPICard
          title="Ratio Ejec./Dis."
          value={ratio}
          suffix="%"
          subtitle="Ejecutados ÷ Diseñados × 100"
          hint="Porcentaje de cobertura: qué parte de los casos diseñados ya fueron ejecutados. 100% significa que todos los casos diseñados corrieron al menos una vez."
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          accent="#7c3aed"
        />
      </div>

      {/* Sección 1: Diseño */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
        <span className="mr-2 inline-block h-[2px] w-6 align-middle bg-[#2E5FA3]" />
        Diseño de Casos
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SingleBarCard
          title={`Diseño Casos por ${unitSingular}`}
          subtitle="Total de casos diseñados en el período"
          data={data.designedTotal}
          metric="designed"
        />
        <div className="lg:col-span-2">
          <GroupedBarCard
            title="Diseños por Iniciativas"
            subtitle="Distribución del diseño por proyecto"
            labels={data.labels}
            series={data.designedByProject}
            icon={ICONS.designed}
          />
        </div>
        <div className="lg:col-span-3">
          <AverageLineCard
            title={`Promedio de Diseño por ${unitSingular}`}
            subtitle="Casos diseñados promedio por analista"
            data={data.designedAverage}
            color={METRIC.designed.color}
          />
        </div>
      </div>

      {/* Sección 2: Ejecución */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
        <span className="mr-2 inline-block h-[2px] w-6 align-middle bg-[#0891b2]" />
        Ejecución
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SingleBarCard
          title={`Ejecución Casos por ${unitSingular}`}
          subtitle="Total de casos ejecutados en el período"
          data={data.executedTotal}
          metric="executed"
        />
        <div className="lg:col-span-2">
          <GroupedBarCard
            title="Ejecución por Iniciativas"
            subtitle="Distribución de la ejecución por proyecto"
            labels={data.labels}
            series={data.executedByProject}
            icon={ICONS.executed}
          />
        </div>
        <div className="lg:col-span-3">
          <AverageLineCard
            title={`Promedio de Ejecución por ${unitSingular}`}
            subtitle="Casos ejecutados promedio por analista"
            data={data.executedAverage}
            color={METRIC.executed.color}
          />
        </div>
      </div>

      {/* Sección 3: Defectos */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
        <span className="mr-2 inline-block h-[2px] w-6 align-middle bg-[#dc2626]" />
        Defectos
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SingleBarCard
          title={`Defectos Reportados por ${unitSingular}`}
          subtitle="Total de bugs detectados"
          data={data.defectsTotal}
          metric="defects"
        />
        <div className="lg:col-span-2">
          <GroupedBarCard
            title={`Defectos por Proyecto`}
            subtitle="Distribución de defectos por iniciativa"
            labels={data.labels}
            series={data.defectsByProject}
            icon={ICONS.defects}
          />
        </div>
      </div>

      {/* Sección Analistas */}
      <section className="rounded-xl border bg-white p-5 shadow-sm print:shadow-none">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1F3864]">Analistas por Iniciativa</h3>
            <p className="text-[11px] text-gray-500">Asignación actual de recursos QA por proyecto</p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {data.analysts.map((a) => (
            <div
              key={a.project}
              className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2E5FA3]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{a.project}</p>
                <p className="text-[11px] text-gray-500">
                  {a.testers.length > 0 ? a.testers.join(", ") : "Sin analistas asignados"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
