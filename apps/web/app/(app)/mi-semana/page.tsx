"use client";

import { useEffect, useState } from "react";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";

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

  useEffect(() => {
    apiClient<TesterProfile[]>("/api/testers/me")
      .then((rows) => {
        setTesters(rows);
        if (rows.length > 0) setSelectedTesterId(rows[0].id);
      })
      .catch((e: any) => setError(e?.message ?? "Error"));
  }, []);

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
    </div>
  );
}
