"use client";

import { use, useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";

export default function EquipoSemanaPage({
  params,
}: {
  params: Promise<{ testerId: string }>;
}) {
  const { testerId } = use(params);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [testerName, setTesterName] = useState<string>("");
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  useEffect(() => {
    apiClient<{ id: string; projectId: string; name: string }>(
      `/api/testers/${testerId}`
    )
      .then((t) => {
        setTesterName(t.name);
        apiClient<Array<{ id: string }>>(`/api/cycles?projectId=${t.projectId}`)
          .then((cs) => setCycleId(cs?.[0]?.id ?? null))
          .catch(() => setCycleId(null));
      })
      .catch(() => {});
  }, [testerId]);

  if (!cycleId) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-[#1F3864]">Semana del tester</h1>
        <span className="text-sm text-gray-600">· {testerName}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setWeek((w) => subWeeks(w, 1))}
            className="rounded border px-3 py-1"
          >
            ←
          </button>
          <span className="min-w-[180px] text-center">
            {format(week, "d MMM yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setWeek((w) => addWeeks(w, 1))}
            className="rounded border px-3 py-1"
          >
            →
          </button>
        </div>
      </header>
      <WeeklyGrid testerId={testerId} cycleId={cycleId} weekStart={week} />
    </div>
  );
}
