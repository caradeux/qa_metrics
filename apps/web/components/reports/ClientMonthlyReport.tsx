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
} from "recharts";

const SERIES_COLORS = [
  "#1F3864",
  "#2E5FA3",
  "#5B9BD5",
  "#9DC3E6",
  "#BDD7EE",
  "#D9E2F3",
];
const TOTAL_COLOR = "#1F3864";

interface SeriesTotal {
  months: string[];
  values: number[];
}
interface SeriesByProject {
  project: string;
  values: number[];
}
interface Props {
  data: {
    client: { id: string; name: string };
    months: string[];
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
  months: number;
  onChangeMonths: (n: number) => void;
}

function singleSeries(data: SeriesTotal) {
  return data.months.map((m, i) => ({ month: m, value: data.values[i] }));
}

function multiSeries(months: string[], series: SeriesByProject[]) {
  return months.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    for (const s of series) row[s.project] = s.values[i] ?? 0;
    return row;
  });
}

function SingleBarCard({
  title,
  data,
  color = TOTAL_COLOR,
}: {
  title: string;
  data: SeriesTotal;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm print:shadow-none">
      <h3 className="mb-2 text-sm font-semibold text-[#1F3864]">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={singleSeries(data)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="value"
            fill={color}
            name={title}
            label={{ position: "top", fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarCard({
  title,
  months,
  series,
}: {
  title: string;
  months: string[];
  series: SeriesByProject[];
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm print:shadow-none">
      <h3 className="mb-2 text-sm font-semibold text-[#1F3864]">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={multiSeries(months, series)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.project}
              dataKey={s.project}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClientMonthlyReport({ data, months, onChangeMonths }: Props) {
  return (
    <div className="p-6">
      <style jsx global>{`
        @media print {
          aside,
          header,
          .print-hide {
            display: none !important;
          }
          body {
            background: white;
          }
          .shadow-sm {
            box-shadow: none !important;
          }
        }
      `}</style>
      <header className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">
            Reporte mensual · {data.client.name}
          </h1>
          <p className="text-sm text-gray-600">
            Indicadores de los últimos {months} meses
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 print-hide">
          <label className="text-sm text-gray-700">Meses:</label>
          <select
            value={months}
            onChange={(e) => onChangeMonths(Number(e.target.value))}
            className="rounded border p-1 text-sm"
          >
            {[3, 6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="rounded bg-[#1F3864] px-3 py-1 text-sm text-white hover:opacity-90"
          >
            Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SingleBarCard title="Diseño Casos por Mes" data={data.designedTotal} />
        <GroupedBarCard
          title="Diseños por Iniciativas"
          months={data.months}
          series={data.designedByProject}
        />
        <SingleBarCard
          title="Promedio de Diseño por Mes"
          data={data.designedAverage}
          color="#2E5FA3"
        />
        <SingleBarCard
          title="Ejecución Casos por Mes"
          data={data.executedTotal}
        />
        <GroupedBarCard
          title="Ejecución por Iniciativas"
          months={data.months}
          series={data.executedByProject}
        />
        <SingleBarCard
          title="Promedio de Ejecución por Mes"
          data={data.executedAverage}
          color="#2E5FA3"
        />
        <SingleBarCard
          title="Defectos Reportados por Mes"
          data={data.defectsTotal}
          color="#C00000"
        />
        <GroupedBarCard
          title="Defectos por Proyectos - Reportados por Mes"
          months={data.months}
          series={data.defectsByProject}
        />
      </div>

      <section className="mt-6 rounded-lg border bg-white p-4 shadow-sm print:shadow-none">
        <h2 className="mb-3 text-base font-semibold text-[#1F3864]">
          Analistas por iniciativa
        </h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {data.analysts.map((a) => (
            <li key={a.project} className="flex gap-2">
              <span className="font-medium text-gray-700">{a.project}:</span>
              <span className="text-gray-600">
                {a.testers.length > 0 ? a.testers.join(", ") : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
