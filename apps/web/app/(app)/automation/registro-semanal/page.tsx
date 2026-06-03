"use client";

import { useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { AutomationWeeklyGrid } from "@/components/automation/AutomationWeeklyGrid";

interface TesterProfile {
  id: string;
  projectId: string;
  name: string;
  allocation: number;
  project: { id: string; name: string; modality: string; client: { name: string } };
  _count?: { assignments: number; automationAssignments: number };
}

export default function RegistroSemanalAutomationPage() {
  const [testers, setTesters] = useState<TesterProfile[]>([]);
  const [selectedTesterId, setSelectedTesterId] = useState<string | null>(null);
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient<TesterProfile[]>("/api/testers/me")
      .then((rows) => {
        // Un automatizador es un tester con asignaciones de automatización,
        // sin importar la modalidad del proyecto (un proyecto puede ser mixto).
        const autos = rows.filter((t) => (t._count?.automationAssignments ?? 0) > 0);
        setTesters(autos);
        if (autos.length === 1) setSelectedTesterId(autos[0].id);
        setLoaded(true);
      })
      .catch((e: any) => {
        // 404 "not a tester": el usuario no tiene perfil de tester/automatizador.
        // No es un error: se muestra el estado vacío amable.
        if (e?.status === 404) setTesters([]);
        else setError(e?.message ?? "Error");
        setLoaded(true);
      });
  }, []);

  const tester = testers.find((t) => t.id === selectedTesterId) ?? null;

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!loaded) return <div className="p-6 text-sm text-gray-400">Cargando…</div>;
  if (testers.length === 0) {
    return <div className="p-6 text-sm text-gray-500">No estás asignado como automatizador a ningún proyecto de automatización.</div>;
  }

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Registro semanal · Automatización</h1>
        {testers.length > 1 ? (
          <select
            value={selectedTesterId ?? ""}
            onChange={(e) => setSelectedTesterId(e.target.value || null)}
            className={`rounded border p-1.5 text-sm font-medium ${selectedTesterId ? "" : "border-amber-400 bg-amber-50 text-amber-900"}`}
          >
            <option value="">— Seleccionar proyecto —</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>{t.project.client.name} · {t.project.name}</option>
            ))}
          </select>
        ) : tester ? (
          <span className="text-sm text-gray-600">· {tester.project.client.name} · {tester.project.name}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeek((w) => subWeeks(w, 1))} className="rounded border px-3 py-1">←</button>
          <span className="min-w-[180px] text-center font-medium">Semana del {format(week, "d 'de' MMM yyyy", { locale: es })}</span>
          <button onClick={() => setWeek((w) => addWeeks(w, 1))} className="rounded border px-3 py-1">→</button>
        </div>
      </header>

      {tester ? (
        <AutomationWeeklyGrid testerId={tester.id} weekStart={week} />
      ) : (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center text-sm text-amber-900">
          Selecciona un proyecto para registrar tu semana.
        </div>
      )}
    </div>
  );
}
