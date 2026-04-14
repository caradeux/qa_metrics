"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { startOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";
import { WeeklyGrid } from "@/components/records/WeeklyGrid";

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient<Tester>(`/api/testers/${testerId}`)
      .then(setTester)
      .catch((e: any) => setError(e?.message ?? "Error al cargar"))
      .finally(() => setLoading(false));
  }, [testerId]);

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
    </div>
  );
}
