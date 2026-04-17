"use client";

import { useCallback, useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { activitiesApi, apiClient, type Activity } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList } from "@/components/activities/ActivityList";

interface TesterProfile {
  id: string;
  projectId: string;
  name: string;
  allocation: number;
  project: { id: string; name: string; client: { name: string } };
}

export default function MiSemanaPage() {
  const [testers, setTesters] = useState<TesterProfile[]>([]);
  const [selectedTesterId, setSelectedTesterId] = useState<string | null>(null);
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [error, setError] = useState<string | null>(null);

  // Activities state
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [dayActivities, setDayActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  useEffect(() => {
    apiClient<TesterProfile[]>("/api/testers/me")
      .then((rows) => {
        setTesters(rows);
        if (rows.length > 0) setSelectedTesterId(rows[0].id);
      })
      .catch((e: any) => setError(e?.message ?? "Error"));
  }, []);

  const loadActivities = useCallback(async (testerId: string, date: string) => {
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    try {
      const rows = await activitiesApi.list({ testerId, from, to });
      setDayActivities(rows);
    } catch {
      setDayActivities([]);
    }
  }, []);

  useEffect(() => {
    if (selectedTesterId && selectedDate) {
      loadActivities(selectedTesterId, selectedDate);
    }
  }, [selectedTesterId, selectedDate, loadActivities]);

  const tester = testers.find((t) => t.id === selectedTesterId) ?? null;

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (testers.length === 0) return <div className="p-6">Cargando…</div>;
  if (!tester) return <div className="p-6">Selecciona un proyecto.</div>;

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Mi semana</h1>
        {testers.length > 1 ? (
          <select
            value={selectedTesterId ?? ""}
            onChange={(e) => setSelectedTesterId(e.target.value)}
            className="rounded border p-1.5 text-sm font-medium"
          >
            {testers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.project.client.name} · {t.project.name} ({t.allocation}%)
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-600">
            · {tester.project.client.name} · {tester.project.name} ({tester.allocation}%)
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeek((w) => subWeeks(w, 1))} className="rounded border px-3 py-1">←</button>
          <span className="min-w-[180px] text-center font-medium">
            Semana del {format(week, "d 'de' MMM yyyy", { locale: es })}
          </span>
          <button onClick={() => setWeek((w) => addWeeks(w, 1))} className="rounded border px-3 py-1">→</button>
        </div>
      </header>

      <WeeklyGrid testerId={tester.id} weekStart={week} />

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
            loadActivities(tester.id, selectedDate);
          }}
        />

        {showForm && (
          <ActivityForm
            testerId={tester.id}
            initial={editing}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); loadActivities(tester.id, selectedDate); }}
          />
        )}
      </section>
    </div>
  );
}
