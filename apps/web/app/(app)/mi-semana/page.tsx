"use client";

import { useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";

export default function MiSemanaPage() {
  const [tester, setTester] = useState<{
    id: string;
    projectId: string;
    name: string;
  } | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<{ id: string; projectId: string; name: string }>(
      "/api/testers/me"
    )
      .then((t) => {
        setTester(t);
        apiClient<Array<{ id: string }>>(`/api/cycles?projectId=${t.projectId}`)
          .then((cs) => setCycleId(cs?.[0]?.id ?? null))
          .catch(() => setCycleId(null));
      })
      .catch((e: any) => setError(e?.message ?? "Error"));
  }, []);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!tester) return <div className="p-6">Cargando…</div>;
  if (!cycleId)
    return (
      <div className="p-6">No hay ciclo activo para tu proyecto.</div>
    );

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Mi semana</h1>
        <span className="text-sm text-gray-600">· {tester.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setWeek((w) => subWeeks(w, 1))}
            className="rounded border px-3 py-1"
          >
            ←
          </button>
          <span className="min-w-[180px] text-center font-medium">
            Semana del {format(week, "d 'de' MMM yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setWeek((w) => addWeeks(w, 1))}
            className="rounded border px-3 py-1"
          >
            →
          </button>
        </div>
      </header>
      <WeeklyGrid testerId={tester.id} cycleId={cycleId} weekStart={week} />
    </div>
  );
}
