"use client";

import { useEffect, useState } from "react";
import {
  occupationApi,
  activitiesApi,
  type OccupationRow,
  type Activity,
  apiClient,
} from "@/lib/api-client";
import { OccupationChart } from "@/components/activities/OccupationChart";
import { OccupationTable } from "@/components/activities/OccupationTable";
import { ActivityList } from "@/components/activities/ActivityList";

interface TesterOption {
  id: string;
  name: string;
  projectId: string;
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}

export default function OccupationReportPage() {
  const [testers, setTesters] = useState<TesterOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [{ from, to }, setRange] = useState(weekRange());
  const [rows, setRows] = useState<OccupationRow[]>([]);
  const [drill, setDrill] = useState<{
    tester: OccupationRow;
    activities: Activity[];
  } | null>(null);

  useEffect(() => {
    apiClient<TesterOption[]>("/api/testers").then((list) => {
      setTesters(list);
      setSelected(list.map((t) => t.id));
    });
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setRows([]);
      return;
    }
    occupationApi
      .get({ testerIds: selected, from, to: `${to}T23:59:59.999Z` })
      .then(setRows);
  }, [selected, from, to]);

  async function openDrill(row: OccupationRow) {
    const acts = await activitiesApi.list({
      testerId: row.testerId,
      from,
      to: `${to}T23:59:59.999Z`,
    });
    setDrill({ tester: row, activities: acts });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Ocupación de testers
            </h1>
            <p className="text-[11px] text-gray-400">
              Distribución de horas por categoría en el período seleccionado
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Filtros
        </p>
        <div className="flex flex-wrap gap-5 items-end">
          <label className="block">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Desde
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange({ from: e.target.value, to })}
              className="mt-1 block border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Hasta
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange({ from, to: e.target.value })}
              className="mt-1 block border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
            />
          </label>
          <label className="block min-w-[240px]">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Testers
            </span>
            <select
              multiple
              value={selected}
              onChange={(e) =>
                setSelected(
                  Array.from(e.target.selectedOptions).map((o) => o.value)
                )
              }
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
            >
              {testers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-6">
        <OccupationChart rows={rows} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
        <OccupationTable rows={rows} onSelect={openDrill} />
      </div>

      {/* Drilldown modal */}
      {drill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDrill(null)}
        >
          <div
            className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-3xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded bg-[#1F3864] flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">
                {drill.tester.testerName} — actividades {from} a {to}
              </h2>
            </div>
            <ActivityList activities={drill.activities} />
            <div className="text-right mt-5">
              <button
                onClick={() => setDrill(null)}
                className="px-4 py-1.5 text-[11px] font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
