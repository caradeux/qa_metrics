"use client";

import { useCallback, useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { activitiesApi, apiClient, type Activity } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList } from "@/components/activities/ActivityList";
import { OccupationDayBar } from "@/components/activities/OccupationDayBar";

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
        // Si tiene solo un proyecto, seleccionamos automáticamente (no hay ambigüedad).
        // Con varios, dejamos vacío para forzar una elección consciente del tester
        // y evitar cargar datos al proyecto equivocado por accidente.
        if (rows.length === 1) setSelectedTesterId(rows[0].id);
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

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Mi semana</h1>
        {testers.length > 1 ? (
          <select
            value={selectedTesterId ?? ""}
            onChange={(e) => setSelectedTesterId(e.target.value || null)}
            className={`rounded border p-1.5 text-sm font-medium ${
              selectedTesterId ? "" : "border-amber-400 bg-amber-50 text-amber-900"
            }`}
          >
            <option value="">— Seleccionar proyecto —</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.project.client.name} · {t.project.name} ({t.allocation}%)
              </option>
            ))}
          </select>
        ) : tester ? (
          <span className="text-sm text-gray-600">
            · {tester.project.client.name} · {tester.project.name} ({tester.allocation}%)
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeek((w) => subWeeks(w, 1))} className="rounded border px-3 py-1">←</button>
          <span className="min-w-[180px] text-center font-medium">
            Semana del {format(week, "d 'de' MMM yyyy", { locale: es })}
          </span>
          <button onClick={() => setWeek((w) => addWeeks(w, 1))} className="rounded border px-3 py-1">→</button>
        </div>
      </header>

      {!tester ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-semibold text-amber-900">Selecciona un proyecto para comenzar</p>
          <p className="mt-1 text-xs text-amber-700">
            Estás asignado a {testers.length} proyectos. Elige el correcto antes de registrar tu semana.
          </p>
        </div>
      ) : (
        <WeeklyGrid testerId={tester.id} weekStart={week} />
      )}

      {/* ── Actividades del día ── */}
      {tester && (
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
              loadActivities(tester.id, selectedDate);
            }}
          />
        </div>

        {showForm && (
          <ActivityForm
            testerId={tester.id}
            initial={editing}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); loadActivities(tester.id, selectedDate); }}
          />
        )}
      </section>
      )}
    </div>
  );
}
