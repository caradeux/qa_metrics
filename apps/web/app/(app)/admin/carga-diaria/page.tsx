"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

interface DailyLoadRow {
  userId: string;
  userName: string;
  userEmail: string;
  daily: {
    loaded: boolean;
    storiesCount: number;
    designed: number;
    executed: number;
    defects: number;
    lastAt: string | null;
  };
  activities: {
    loaded: boolean;
    hours: number;
    lastAt: string | null;
  };
}

interface DailyLoadResponse {
  date: string;
  isNonBusinessDay: boolean;
  rows: DailyLoadRow[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

export default function AdminCargaDiariaPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(todayIso());
  const [data, setData] = useState<DailyLoadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<DailyLoadResponse>(
        `/api/admin/daily-load?date=${d}`
      );
      setData(res);
    } catch (e: any) {
      if (e?.status === 403) setError("No autorizado (solo ADMIN)");
      else setError(e?.message ?? "Error al cargar");
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(date);
  }, [date, fetchData]);

  const summary = useMemo(() => {
    if (!data) return { dailyOk: 0, actOk: 0, none: 0, total: 0 };
    const total = data.rows.length;
    const dailyOk = data.rows.filter((r) => r.daily.loaded).length;
    const actOk = data.rows.filter((r) => r.activities.loaded).length;
    const none = data.rows.filter((r) => !r.daily.loaded && !r.activities.loaded).length;
    return { dailyOk, actOk, none, total };
  }, [data]);

  if (user && user.role?.name !== "ADMIN") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Carga diaria por usuario</h1>
        <p className="mt-4 text-red-600">No autorizado. Esta vista es solo para ADMIN.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1F3864]">Carga diaria por usuario</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Fecha:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      {data?.isNonBusinessDay && (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          Este día es feriado o fin de semana — no se espera carga.
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded border bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Con registros diarios</div>
            <div className="text-xl font-semibold text-[#1F3864]">
              {summary.dailyOk}/{summary.total}
            </div>
          </div>
          <div className="rounded border bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Con actividades</div>
            <div className="text-xl font-semibold text-[#1F3864]">
              {summary.actOk}/{summary.total}
            </div>
          </div>
          <div className="rounded border bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Sin ningún registro</div>
            <div className="text-xl font-semibold text-[#1F3864]">{summary.none}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />
          ))}
        </div>
      )}

      {!loading && data && data.rows.length === 0 && (
        <div className="rounded border bg-white px-6 py-10 text-center text-slate-500">
          No hay analistas con Tester vinculado.
        </div>
      )}

      {!loading && data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Usuario</th>
                <th className="text-left px-4 py-2">Registros diarios</th>
                <th className="text-left px-4 py-2">Actividades</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.userName}</div>
                    <div className="text-xs text-slate-500">{r.userEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.daily.loaded ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">✅</span>
                        <span>
                          {r.daily.storiesCount} stories · {r.daily.designed}D/{r.daily.executed}E/{r.daily.defects}B
                          {r.daily.lastAt && ` · última ${formatTime(r.daily.lastAt)}`}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-slate-500">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs">❌</span>
                        Sin registros
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.activities.loaded ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">✅</span>
                        <span>
                          {r.activities.hours}h
                          {r.activities.lastAt && ` · última ${formatTime(r.activities.lastAt)}`}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-slate-500">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs">❌</span>
                        Sin actividades
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
