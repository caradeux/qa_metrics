"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { activitiesApi, apiClient, type Activity } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList } from "@/components/activities/ActivityList";
import { OccupationDayBar } from "@/components/activities/OccupationDayBar";

interface Tester { id: string; projectId: string; name: string }

export default function EquipoSemanaPage({
  params,
}: {
  params: Promise<{ testerId: string }>;
}) {
  const { testerId } = use(params);
  const [tester, setTester] = useState<Tester | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Activities state
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [dayActivities, setDayActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient<Tester>(`/api/testers/${testerId}`)
      .then(setTester)
      .catch((e: any) => setError(e?.message ?? "Error al cargar"))
      .finally(() => setLoading(false));
  }, [testerId]);

  const loadActivities = useCallback(async (date: string) => {
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    try {
      const rows = await activitiesApi.list({ testerId, from, to });
      setDayActivities(rows);
    } catch {
      setDayActivities([]);
    }
  }, [testerId]);

  useEffect(() => {
    if (selectedDate) {
      loadActivities(selectedDate);
    }
  }, [selectedDate, loadActivities]);

  if (loading) return <div className="p-6">Cargando…</div>;

  if (error || !tester) {
    return (
      <div className="p-6">
        <p className="text-red-600">No se pudo cargar el tester. {error}</p>
        <Link href="/equipo" className="mt-2 inline-block text-sm text-[#2E5FA3] hover:underline">
          ← Volver al equipo
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Semana del tester</h1>
        <span className="text-sm text-gray-600">· {tester.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeek((w) => subWeeks(w, 1))} className="rounded border px-3 py-1">←</button>
          <span className="min-w-[180px] text-center">{format(week, "d MMM yyyy", { locale: es })}</span>
          <button onClick={() => setWeek((w) => addWeeks(w, 1))} className="rounded border px-3 py-1">→</button>
        </div>
      </header>

      <WeeklyGrid testerId={testerId} weekStart={week} />

      {/* ── Actividades del día ── */}
      <section className="mt-8 rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 12a3 3 0 100-6 3 3 0 000 6zm10 0a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#1F3864]">Actividades del día</h2>
            <p className="text-[11px] text-gray-500">Reuniones, capacitaciones, inducciones y traspasos</p>
          </div>
          <label className="ml-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Fecha</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-[#1F3864] focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
            />
          </label>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#1F3864] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#2E5FA3]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva actividad
          </button>
        </div>

        <OccupationDayBar
          totalHours={dayActivities.reduce(
            (s, a) => s + (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 3600000,
            0,
          )}
        />

        <div className="mt-4">
          <ActivityList
            activities={dayActivities}
            onEdit={(a) => { setEditing(a); setShowForm(true); }}
            onDelete={async (a) => {
              if (!confirm("¿Eliminar actividad?")) return;
              await activitiesApi.remove(a.id);
              loadActivities(selectedDate);
            }}
          />
        </div>

        {showForm && (
          <ActivityForm
            testerId={testerId}
            initial={editing}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); loadActivities(selectedDate); }}
          />
        )}
      </section>
    </div>
  );
}
