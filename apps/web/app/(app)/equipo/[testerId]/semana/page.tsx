"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { activitiesApi, apiClient, type Activity } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList } from "@/components/activities/ActivityList";

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
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-[#1F3864]">Actividades del día</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="ml-auto px-3 py-1 bg-[#1F3864] text-white rounded text-sm hover:bg-[#2E5FA3]"
          >
            + Nueva actividad
          </button>
        </div>

        <ActivityList
          activities={dayActivities}
          onEdit={(a) => { setEditing(a); setShowForm(true); }}
          onDelete={async (a) => {
            if (!confirm("¿Eliminar actividad?")) return;
            await activitiesApi.remove(a.id);
            loadActivities(selectedDate);
          }}
        />

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
